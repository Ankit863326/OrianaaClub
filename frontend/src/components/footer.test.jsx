import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from '@jest/globals';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer.jsx';

// The footer should keep all important destinations discoverable and use the safe test URL.
describe('site footer', () => {
  test('renders exploration links, social links, and the configured admin destination', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Resorts' })).toHaveAttribute('href', '/resorts');
    expect(screen.getByRole('link', { name: 'Membership benefits' })).toHaveAttribute('href', '/membership-benefits');
    expect(screen.getByRole('link', { name: 'Instagram' })).toHaveAttribute('href', 'https://www.instagram.com/saptagiriresorts?obrf=NjN3Z243MzBndHhs');
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/company/saptagiri-hospitality-lifestyle/posts/?feedView=all');
    expect(screen.getByRole('link', { name: 'Admin Login' })).toHaveAttribute('href', '/admin');
    expect(screen.getByText(/© 2026 Orianaa Club/)).toBeInTheDocument();
  });
});
