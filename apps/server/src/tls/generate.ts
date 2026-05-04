import selfsigned from 'selfsigned';
import { createHash } from 'node:crypto';

export type CertBundle = {
  key: string;
  cert: string;
  fingerprint: string;
  notBefore: Date;
  notAfter: Date;
};

export function generateCert(opts: { commonName: string; validityYears: number }): CertBundle {
  const attrs = [{ name: 'commonName', value: opts.commonName }];
  const extensions = [
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' },
      ],
    },
  ];
  const notBefore = new Date();
  const notAfter = new Date();
  notAfter.setFullYear(notAfter.getFullYear() + opts.validityYears);
  const pems = selfsigned.generate(attrs, {
    algorithm: 'sha256',
    keySize: 2048,
    days: opts.validityYears * 365,
    extensions,
  });
  const fingerprint = createHash('sha256')
    .update(Buffer.from(pems.cert.replace(/-----.+-----|\s+/g, ''), 'base64'))
    .digest('hex')
    .toUpperCase()
    .match(/.{2}/g)!
    .join(':');
  return {
    key: pems.private,
    cert: pems.cert,
    fingerprint,
    notBefore,
    notAfter,
  };
}
