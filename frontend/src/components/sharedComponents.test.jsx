import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, jest, test } from '@jest/globals';
import { MemoryRouter } from 'react-router-dom';
import PlanCard, { GoldWaveWatermark, TierEmblemIcon } from './PlanCard.jsx';
import BackToTop from './BackToTop.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Label } from './ui/label.jsx';
import { Textarea } from './ui/textarea.jsx';

describe('shared display components', () => {
  test('renders plan information, highlights selection, and reports button clicks', () => {
    const onSelect = jest.fn();
    render(
      <PlanCard
        plan={{ title: 'Signature', subtitle: 'Ten years', priceLabel: '₹1,00,000', isFeatured: true, cohorts: [{ label: 'Adults', displayAmount: '20,000' }] }}
        selected
        onSelect={onSelect}
        buttonLabel="Choose plan"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Signature' })).toBeInTheDocument();
    expect(screen.getByText('20,000')).toBeInTheDocument();
    expect(screen.getByText('1 Redemption point = 1 Rupee')).toBeInTheDocument();
    expect(screen.getByText('₹1,00,000')).toBeInTheDocument();
    expect(document.querySelector('.mb-card__selected-badge')).toHaveTextContent('Selected');
    expect(screen.getByRole('button', { name: 'Selected' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Selected' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test('shows the redemption rate but hides an empty tier list', () => {
    const { container } = render(
      <PlanCard
        plan={{ title: 'Plan without tiers', subtitle: 'Term', priceLabel: '₹10' }}
        buttonLabel="Change Plan"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('1 Redemption point = 1 Rupee')).toBeInTheDocument();
    expect(container.querySelector('.mb-card__cohorts')).not.toBeInTheDocument();
  });

  test('supports disabled plan selection and route links', () => {
    const { rerender } = render(
      <MemoryRouter>
        <PlanCard plan={{ title: 'Plan', subtitle: 'Term', priceLabel: '₹10', cohorts: [] }} disabled buttonLabel="Select" onSelect={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();
    rerender(
      <MemoryRouter>
        <PlanCard plan={{ title: 'Plan', subtitle: 'Term', priceLabel: '₹10', cohorts: [] }} to="/join" buttonLabel="Join" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Join' })).toHaveAttribute('href', '/join');
  });

  test('provides accessible decorative emblem and watermark components', () => {
    const { container } = render(
      <div><GoldWaveWatermark isDark /><TierEmblemIcon isDark /></div>,
    );
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
    expect(container.querySelector('.tier-emblem--dark')).toBeInTheDocument();
  });

  test('applies common variants and forwards input form props', () => {
    render(
      <form>
        <Button variant="outline">Save</Button>
        <Label htmlFor="member-name">Member name</Label>
        <Input id="member-name" placeholder="Your name" />
        <Textarea aria-label="Notes" placeholder="Optional notes" />
      </form>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('border');
    expect(screen.getByLabelText('Member name')).toHaveAttribute('placeholder', 'Your name');
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveAttribute('placeholder', 'Optional notes');
  });

  test('shows the back-to-top button only past the scroll threshold and handles its click', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    window.requestAnimationFrame = (callback) => {
      callback();
      return 1;
    };
    window.cancelAnimationFrame = jest.fn();
    const { rerender } = render(<BackToTop />);
    expect(document.querySelector('.back-to-top')).toHaveAttribute('aria-hidden', 'true');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 600 });
    fireEvent.scroll(window);
    rerender(<BackToTop />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));
    expect(window.scrollTo).toHaveBeenCalled();
  });
});
