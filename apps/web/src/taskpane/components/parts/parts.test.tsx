import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { TextPart } from './TextPart';
import { ExecuteCodePart } from './ExecuteCodePart';
import { StepStartPart } from './StepStartPart';
import { LookupSkillPart } from './LookupSkillPart';
import { DynamicToolPart } from './DynamicToolPart';
import { ApprovalRequestedPart } from './ApprovalRequestedPart';

function renderWithFluent(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

describe('TextPart', () => {
  it('renders text', () => {
    render(<TextPart part={{ text: 'hello' }} />);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});

describe('StepStartPart', () => {
  it('renders an hr', () => {
    const { container } = render(<StepStartPart />);
    expect(container.querySelector('hr')).not.toBeNull();
  });
});

describe('ExecuteCodePart', () => {
  it('shows Approve when state is input-available', () => {
    const onApprove = vi.fn();
    renderWithFluent(
      <ExecuteCodePart
        part={{ state: 'input-available', toolCallId: 'tc', input: { code: 'await 1' } }}
        onApprove={onApprove}
        onReject={() => {}}
        highlight={(s) => s}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Approve & Run/i }));
    expect(onApprove).toHaveBeenCalledWith('tc', 'await 1');
  });

  it('shows output-error message in error state', () => {
    renderWithFluent(
      <ExecuteCodePart
        part={{ state: 'output-error', toolCallId: 'tc', errorText: 'kaboom' }}
        onApprove={() => {}}
        onReject={() => {}}
        highlight={(s) => s}
      />,
    );
    expect(screen.getByText('kaboom')).toBeInTheDocument();
  });
});

describe('LookupSkillPart', () => {
  it('shows looking-up label when in flight', () => {
    render(<LookupSkillPart part={{ state: 'input-available', input: { name: 'tables' } }} />);
    expect(screen.getByText(/Looking up: tables/)).toBeInTheDocument();
  });

  it('shows looked-up label when complete', () => {
    render(
      <LookupSkillPart
        part={{ state: 'output-available', input: { name: 'ranges' }, output: { body: '...' } }}
      />,
    );
    expect(screen.getByText(/Looked up: ranges/)).toBeInTheDocument();
  });
});

describe('DynamicToolPart', () => {
  it('renders tool name and state in summary', () => {
    render(<DynamicToolPart part={{ toolName: 'mcp_x/list', state: 'output-available', input: {} }} />);
    expect(screen.getByText(/mcp_x\/list \(output-available\)/)).toBeInTheDocument();
  });
});

describe('ApprovalRequestedPart', () => {
  it('returns null unless state is approval-requested', () => {
    const { container } = render(
      <ApprovalRequestedPart
        part={{ type: 'tool-x', state: 'output-available' }}
        onResponse={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls onResponse with approved=true on Approve click', () => {
    const onResponse = vi.fn();
    render(
      <ApprovalRequestedPart
        part={{
          type: 'tool-foo',
          state: 'approval-requested',
          approval: { id: 'a1' },
          input: { x: 1 },
        }}
        onResponse={onResponse}
      />,
    );
    fireEvent.click(screen.getByText('Approve'));
    expect(onResponse).toHaveBeenCalledWith('a1', true);
  });

  it('calls onResponse with approved=false on Deny click', () => {
    const onResponse = vi.fn();
    render(
      <ApprovalRequestedPart
        part={{
          type: 'tool-foo',
          state: 'approval-requested',
          approval: { id: 'a1' },
          input: {},
        }}
        onResponse={onResponse}
      />,
    );
    fireEvent.click(screen.getByText('Deny'));
    expect(onResponse).toHaveBeenCalledWith('a1', false);
  });
});
