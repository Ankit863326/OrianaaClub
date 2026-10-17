import { fireEvent, render, screen } from '@testing-library/react';
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  Pagination,
  PasswordField,
  StatCard,
  Toast,
  formatDate,
  formatPaise,
  formatPoints,
  formatRupees,
} from '../src/components/ui.jsx';
import ErrorBoundary from '../src/components/ErrorBoundary.jsx';

// These checks exercise the reusable interface pieces used throughout the admin app.
describe('shared Admin components and formatting', () => {
  test('formats rupees, paise, points, and missing dates for India', () => {
    expect(formatRupees(1250)).toContain('1,250');
    expect(formatPaise(12345)).toContain('123.45');
    expect(formatPoints(12500)).toBe('12,500');
    expect(formatDate(null)).toBe('—');
    expect(formatDate('2025-01-02T00:00:00.000Z')).toBeTruthy();
  });

  test('shows stats and table rows, including custom cell renderers', () => {
    render(<><StatCard label="Members" value="12" detail="10 active" /><DataTable
      columns={[{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status', render: (row) => row.status.toUpperCase() }]}
      rows={[{ id: 1, name: 'Asha', status: 'active' }]}
    /></>);
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('Asha')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  test('shows empty states, accessible toast messages, and dismiss controls', () => {
    const onDismiss = jest.fn();
    render(<><EmptyState>No rows available.</EmptyState><Toast kind="error" onDismiss={onDismiss}>Could not load data</Toast></>);
    expect(screen.getByText('No rows available.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load data');
  });

  test('paginates and disables controls at the ends', () => {
    const onPage = jest.fn();
    render(<Pagination info={{ page: 1, pages: 3, total: 21 }} onPage={onPage} />);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPage).toHaveBeenCalledWith(2);
  });

  test('confirms or cancels a destructive action and can reveal a password', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { rerender } = render(<><ConfirmDialog title="Delete?" onConfirm={onConfirm} onCancel={onCancel}>This cannot be undone.</ConfirmDialog><PasswordField value="Secret123" onChange={() => {}} /></>);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    const password = screen.getByLabelText('Show password');
    fireEvent.click(password);
    expect(screen.getByLabelText('Hide password')).toBeInTheDocument();
    rerender(<EmptyState />);
    expect(screen.getByText('There is nothing to show yet.')).toBeInTheDocument();
  });

  test('shows a clear fallback when a child component crashes', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    function BrokenChild() { throw new Error('Rendering failed safely.'); }
    render(<ErrorBoundary><BrokenChild /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: 'The admin page could not be displayed' })).toBeInTheDocument();
    expect(screen.getByText('Rendering failed safely.')).toBeInTheDocument();
    log.mockRestore();
  });
});
