import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AuthContext from '../context/auth-context.js';
import BenefitsSection from './BenefitsSection.jsx';
import DestinationsSection from './DestinationsSection.jsx';
import ExperienceSection from './FeaturesSection.jsx';
import HeroSection from './HeroSection.jsx';
import LuxuryRoomTabs from './LuxuryRoomTabs.jsx';
import { MapPinCheckIcon } from './MapPinCheckIcon.jsx';
import MembershipReasons from './MembershipReasons.jsx';
import Navbar from './Navbar.jsx';
import OrianaaClubStories from './OrianaaClubStoriesPage.jsx';
import StatsSection from './StatsSection.jsx';

// Keep timers and browser size changes local so independent component tests stay predictable.
afterEach(() => {
  jest.useRealTimers();
  window.innerWidth = 1024;
});

function LocationText() {
  const location = useLocation();
  return <output aria-label="Current path">{location.pathname}</output>;
}

function renderNavbar({ user = null, logout = jest.fn(), initialPath = '/' } = {}) {
  return render(
    <AuthContext.Provider value={{ user, logout }}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Navbar />
        <LocationText />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('shared page sections', () => {
  test('shows all membership benefits and advantages', () => {
    render(<BenefitsSection />);
    expect(screen.getByRole('heading', { name: /More Than a Membership/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7);
    expect(screen.getByText('Priority Access')).toBeInTheDocument();
    expect(screen.getByText('24/7 Support')).toBeInTheDocument();
    expect(screen.getByText('Lifetime access to 150+ curated destinations')).toBeInTheDocument();
  });

  test('renders the stats section and its labels', () => {
    render(<StatsSection />);
    expect(screen.getByRole('heading', { name: 'By The Numbers' })).toBeInTheDocument();
    expect(screen.getByText('Premium Destinations')).toBeInTheDocument();
    expect(screen.getByText('Happy Members')).toBeInTheDocument();
    expect(screen.getByText('Curated Experiences')).toBeInTheDocument();
    expect(screen.getByText('Hours Support')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trusted by Thousands' })).toBeInTheDocument();
  });

  test('moves the experience carousel both ways and keeps five cards visible', () => {
    render(<ExperienceSection />);
    expect(screen.getByRole('heading', { name: /Rooted in the Philosophy/i })).toBeInTheDocument();
    expect(document.querySelectorAll('.slider .card')).toHaveLength(5);
    expect(document.querySelector('.slider .card.center img')).toHaveAttribute('alt', 'Spacious, premium stays for families');
    fireEvent.click(screen.getByRole('button', { name: '←' }));
    expect(document.querySelector('.slider .card.center img')).toHaveAttribute('alt', 'Timeless heritage with contemporary ease');
    fireEvent.click(screen.getByRole('button', { name: '→' }));
    expect(document.querySelector('.slider .card.center img')).toHaveAttribute('alt', 'Spacious, premium stays for families');
  });

  test('changes destination categories and their resort cards', () => {
    render(<DestinationsSection />);
    expect(screen.getByRole('heading', { name: 'Exclusive Stays, Curated by OrianaaClub' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Saptagiri Retreat' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Heritage' }));
    expect(screen.getByRole('button', { name: 'Heritage' })).toHaveClass('active');
    expect(screen.getByRole('heading', { name: 'Jaisalmer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explore all destinations' })).toBeInTheDocument();
  });

  test('changes room category and wraps the image carousel', async () => {
    const { unmount } = render(<LuxuryRoomTabs />);
    expect(screen.getByRole('heading', { name: 'Deluxe Room' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Premium Deluxe Room' }));
    expect(screen.getByRole('heading', { name: 'Premium Deluxe Room' })).toBeInTheDocument();
    const previous = screen.getByRole('button', { name: 'Previous image' });
    fireEvent.click(previous);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Premium Deluxe Room' }).getAttribute('src')).toContain('1564078516393'));
    fireEvent.click(screen.getByRole('button', { name: 'View image 2' }));
    expect(screen.getByRole('img', { name: 'Premium Deluxe Room' }).getAttribute('src')).toContain('1582719478250');
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    await waitFor(() => expect(screen.getByRole('img', { name: 'Premium Deluxe Room' }).getAttribute('src')).toContain('1564078516393'));
    unmount();
  });

  test('cycles through membership comparisons and disables rapid changes', () => {
    jest.useFakeTimers();
    render(<MembershipReasons />);
    expect(screen.getByRole('heading', { name: 'The Saptagiri Way of Living' })).toBeInTheDocument();
    const next = screen.getByRole('button', { name: 'Next reason' });
    fireEvent.click(next);
    expect(next).toBeDisabled();
    act(() => jest.advanceTimersByTime(150));
    expect(screen.getByRole('heading', { name: 'Conscious & Pure Dining' })).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(450));
    expect(next).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous reason' }));
    act(() => jest.advanceTimersByTime(600));
    expect(screen.getByRole('heading', { name: 'The Saptagiri Way of Living' })).toBeInTheDocument();
  });

  test('renders customer stories and their member details', () => {
    const { container } = render(<OrianaaClubStories />);
    expect(screen.getByRole('heading', { name: /Stories from the OrianaaClub Community/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Aman Gupta' })).toBeInTheDocument();
    expect(screen.getByText('Member since 2016')).toBeInTheDocument();
    fireEvent.click(container.querySelector('.stories-grid'));
    fireEvent.blur(container.querySelector('.stories-section'));
  });

  test('renders the decorative map icon and hero scroll prompt', () => {
    const { rerender } = render(<MapPinCheckIcon aria-label="Verified destination" size={32} />);
    expect(screen.getByLabelText('Verified destination').querySelector('svg')).toHaveAttribute('width', '32');
    fireEvent.mouseEnter(screen.getByLabelText('Verified destination'));
    fireEvent.mouseLeave(screen.getByLabelText('Verified destination'));
    rerender(<HeroSection />);
    expect(screen.getByText('Explore')).toBeInTheDocument();
  });
});

describe('navigation behavior', () => {
  test('searches destinations, clears queries, and navigates to a matching result', async () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }));
    const search = screen.getByRole('searchbox', { name: 'Search Orianaa Club' });
    fireEvent.change(search, { target: { value: '   wellness  ' } });
    expect(screen.getAllByRole('link', { name: /Experiences/ }).some((link) => link.getAttribute('href') === '/experiences')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search).toHaveValue('');
    fireEvent.change(search, { target: { value: 'wedding' } });
    fireEvent.submit(screen.getByRole('search'));
    await waitFor(() => expect(screen.getByLabelText('Current path')).toHaveTextContent('/events'));
  });

  test('shows empty search feedback and closes the panel with Escape', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no such resort' } });
    expect(screen.getByText('No matches found')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Open search' })).toHaveAttribute('aria-expanded', 'false');
  });

  test('supports mobile navigation, membership join, and successful logout', async () => {
    const logout = jest.fn().mockResolvedValue(undefined);
    const { rerender } = renderNavbar();
    fireEvent.click(screen.getAllByRole('button', { name: 'Join Membership' })[0]);
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/luxury-membership');
    rerender(
      <AuthContext.Provider value={{ user: { firstName: 'Asha' }, logout }}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Navbar />
          <LocationText />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByText('Hello, Asha')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Logout' })[0]);
    await waitFor(() => expect(screen.getByLabelText('Current path')).toHaveTextContent('/'));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
