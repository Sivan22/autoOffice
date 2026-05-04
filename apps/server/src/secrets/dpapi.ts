// Windows DPAPI wrapper bound to the current user.
// Wraps with CRYPTPROTECT_UI_FORBIDDEN; no entropy for now (machine + user identity is enough).
//
// On non-Windows platforms (Linux/macOS) this module is a no-op shim that
// throws on any attempt to wrap/unwrap. `isDpapiAvailable()` returns false.
// Plan 06 will replace this with a per-install token + an alternate
// keystore on non-Windows targets.
import { dlopen, FFIType, ptr, suffix } from 'bun:ffi';

const isWindows = process.platform === 'win32';

type DpapiBindings = {
  CryptProtectData: (
    pDataIn: number,
    szDataDescr: number,
    pOptionalEntropy: number,
    pvReserved: number,
    pPromptStruct: number,
    dwFlags: number,
    pDataOut: number,
  ) => number;
  CryptUnprotectData: (
    pDataIn: number,
    ppszDataDescr: number,
    pOptionalEntropy: number,
    pvReserved: number,
    pPromptStruct: number,
    dwFlags: number,
    pDataOut: number,
  ) => number;
  LocalFree: (h: number) => number;
};

let crypt32: DpapiBindings | null = null;
let kernel32: { LocalFree: (h: number) => number } | null = null;

function load(): DpapiBindings {
  if (!isWindows) {
    throw new Error('DPAPI is only available on Windows');
  }
  if (crypt32) return crypt32;
  const c = dlopen(`crypt32.${suffix}`, {
    CryptProtectData: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.ptr], returns: FFIType.i32 },
    CryptUnprotectData: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.ptr], returns: FFIType.i32 },
  } as const);
  const k = dlopen(`kernel32.${suffix}`, {
    LocalFree: { args: [FFIType.ptr], returns: FFIType.ptr },
  } as const);
  crypt32 = c.symbols as unknown as DpapiBindings;
  kernel32 = k.symbols as unknown as { LocalFree: (h: number) => number };
  return crypt32;
}

export function isDpapiAvailable(): boolean {
  return isWindows;
}

// DATA_BLOB layout: u32 cbData; ptr pbData
function makeBlob(buf: Uint8Array): { ptr: number; struct: ArrayBuffer } {
  const struct = new ArrayBuffer(16); // 4 padding for alignment + 8 for u64 ptr (x64)
  const view = new DataView(struct);
  view.setUint32(0, buf.byteLength, true);
  // ptr is x64 8-byte at offset 8
  const bufPtr = ptr(buf);
  // Bun's ptr() returns a number (BigInt on x64). Encode as little-endian 8 bytes.
  view.setBigUint64(8, BigInt(bufPtr), true);
  return { ptr: ptr(new Uint8Array(struct)), struct };
}

function readBlob(structPtr: number): Uint8Array {
  // Read DATA_BLOB at structPtr: u32 cbData @ 0, ptr pbData @ 8
  // bun:ffi exposes toArrayBuffer for pointers
  const { toArrayBuffer } = require('bun:ffi') as typeof import('bun:ffi');
  const headerBuf = toArrayBuffer(structPtr, 0, 16);
  const view = new DataView(headerBuf);
  const cb = view.getUint32(0, true);
  const dataPtr = Number(view.getBigUint64(8, true));
  const data = new Uint8Array(toArrayBuffer(dataPtr, 0, cb));
  // Caller must LocalFree dataPtr.
  // copy out before freeing.
  const copy = new Uint8Array(cb);
  copy.set(data);
  return copy;
}

export function wrapSecret(plaintext: string): Uint8Array {
  const fn = load();
  const inBytes = new TextEncoder().encode(plaintext);
  const inBlob = makeBlob(inBytes);

  const outStruct = new ArrayBuffer(16);
  const outPtr = ptr(new Uint8Array(outStruct));

  const CRYPTPROTECT_UI_FORBIDDEN = 0x1;
  const ok = fn.CryptProtectData(inBlob.ptr, 0, 0, 0, 0, CRYPTPROTECT_UI_FORBIDDEN, outPtr);
  if (!ok) {
    throw new Error('CryptProtectData failed');
  }
  const cipher = readBlob(outPtr);
  // Free the LPVOID inside the out blob:
  const view = new DataView(outStruct);
  const dataPtr = Number(view.getBigUint64(8, true));
  kernel32!.LocalFree(dataPtr);
  return cipher;
}

export function unwrapSecret(ciphertext: Uint8Array): string {
  const fn = load();
  const inBlob = makeBlob(ciphertext);

  const outStruct = new ArrayBuffer(16);
  const outPtr = ptr(new Uint8Array(outStruct));

  const CRYPTPROTECT_UI_FORBIDDEN = 0x1;
  const ok = fn.CryptUnprotectData(inBlob.ptr, 0, 0, 0, 0, CRYPTPROTECT_UI_FORBIDDEN, outPtr);
  if (!ok) {
    throw new Error('CryptUnprotectData failed');
  }
  const plain = readBlob(outPtr);
  const view = new DataView(outStruct);
  const dataPtr = Number(view.getBigUint64(8, true));
  kernel32!.LocalFree(dataPtr);
  return new TextDecoder().decode(plain);
}
