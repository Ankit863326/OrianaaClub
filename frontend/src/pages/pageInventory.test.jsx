import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test } from '@jest/globals';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HomePage from '../components/HomePage.jsx';
import Events from './Events/Events.jsx';
import Blog from './Blog/Blog.jsx';
import Experiences from './Experiences/Experiences.jsx';
import RoomCategories from './RoomCategories/RoomCategories.jsx';
import Dashboard from './Dashboard/Dashboard.jsx';
import StepTwo from './LuxuryMembershipStepTwo/StepTwo.jsx';
import StepThree from './LuxuryMembershipStepThree/LuxuryMembershipStepThree.jsx';

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const withRouter = (ui, route = '/') => render(
  <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>,
);

describe('public page inventory', () => {
  beforeEach(() => fetch.mockReset());

  test('home page renders key links and the event carousel changes its featured story', async () => {
    const { container } = withRouter(<HomePage />);
    expect(screen.getByRole('heading', { name: 'The Orianaa Club' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore Resorts' })).toHaveAttribute('href', '/resorts');
    expect(screen.getByRole('button', { name: 'Next event' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Wedding' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next event' }));
    expect(screen.getByRole('heading', { name: 'A slower kind of escape' })).toBeInTheDocument();
    expect(container.querySelectorAll('.home-destination')).toHaveLength(4);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('events page loads API event details and lets a visitor choose an event', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      data: { items: [
        { _id: 'e1', title: 'Autumn Retreat', description: 'Seasonal celebration.', date: '2026-11-10', time: '6 PM', location: 'Pune', image: '/uploads/event.jpg' },
        { _id: 'e2', title: 'Winter Gala', description: 'An elegant evening.', date: '2026-12-12', time: '7 PM', location: 'Coorg' },
      ] },
    }));
    const { container } = withRouter(<Events />);
    expect(await screen.findByRole('heading', { name: 'Autumn Retreat', level: 2 })).toBeInTheDocument();
    expect(screen.getAllByText('6 PM · 10 November 2026')).toHaveLength(2);
    expect(container.querySelector('.ev2-featured__media img')).toHaveAttribute('src', 'http://localhost:5000/media/event.jpg');
    fireEvent.click(screen.getAllByRole('button', { name: 'Discover' })[0]);
    expect(screen.getAllByRole('heading', { name: 'Autumn Retreat' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Explore Events' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('events page provides visible feedback when event retrieval fails', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ message: 'Event calendar is offline.' }, 503));
    withRouter(<Events />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Event calendar is offline.');
  });

  test('journal filters loaded posts, searches, opens a reader, and handles empty results', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      data: { items: [
        { _id: 'p1', title: 'Quiet Weekend', category: 'Wellness', excerpt: 'Rest and reset.', content: 'A full story.', publishedAt: '2026-09-12' },
        { _id: 'p2', title: 'Family Time', category: 'Family', excerpt: 'A shared escape.', content: 'Family story.' },
      ] },
    }));
    const { container } = withRouter(<Blog />);
    expect(await screen.findByRole('heading', { name: /Stories from the\s*art of living well\./ })).toBeInTheDocument();
    expect((await screen.findAllByText('Quiet Weekend')).length).toBeGreaterThan(0);
    const search = container.querySelector('input[placeholder="Search all blogs..."]');
    fireEvent.change(search, { target: { value: 'Quiet' } });
    expect(screen.getAllByText('Quiet Weekend').length).toBeGreaterThan(0);
    fireEvent.click(container.querySelector('.b2-carousel-card .b2-card__capsule'));
    expect(await screen.findByRole('button', { name: '← Back to Journal' })).toBeInTheDocument();
    expect(screen.getByText('A full story.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close page viewer' }));
    fireEvent.change(search, { target: { value: 'no matching story' } });
    expect(screen.getByText('No stories match your search')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('journal explains empty API catalog and supports its reset action', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ data: { items: [] } }));
    withRouter(<Blog />);
    expect(await screen.findByText('No stories have been published yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View all stories' }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('experiences page renders the main experience categories and membership links', () => {
    const { container } = withRouter(<Experiences />);
    expect(screen.getByRole('heading', { name: 'A Taste of Exceptional Living' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Restore. Rebalance. Renew.' })).toBeInTheDocument();
    expect(container.querySelectorAll('.exp-row')).toHaveLength(6);
    expect(screen.getAllByRole('link', { name: /Join/ })).toHaveLength(7);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('room catalogue reveals additional room details and navigates to membership', async () => {
    const { container } = withRouter(<RoomCategories />);
    expect(screen.getByRole('heading', { name: 'A World Of Refined Stays' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Find Your Perfect Stay With Us' })).toBeInTheDocument();
    expect(container.querySelectorAll('.destinations-card__explore-btn')).toHaveLength(4);
    fireEvent.click(screen.getAllByRole('button', { name: /Explore/ })[1]);
    expect((await screen.findAllByText('Premium Deluxe Rooms')).length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('.preferred-card')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('dashboard fetches rewards, filters transactions, and pages through history', async () => {
    fetch.mockImplementation(async (url) => {
      if (String(url).includes('/member/points')) {
        return jsonResponse({
          data: {
            balance: 12500,
            membership: { status: 'active', memberNumber: 'OC-12', plan: { title: 'Gold', subtitle: 'Ten years' } },
            history: { items: [{ _id: 't1', createdAt: '2026-09-12T10:00:00Z', type: 'credit', category: 'membership_award', reason: 'Joining award', amount: 12500, balanceAfter: 12500 }], total: 11, page: 1, pages: 2 },
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    withRouter(<Dashboard />);
    expect(await screen.findByRole('heading', { name: 'Member Dashboard' })).toBeInTheDocument();
    expect(await screen.findAllByText('12,500')).toHaveLength(2);
    expect(screen.getByText('Joining award')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'credit' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const nextButton = screen.getByRole('button', { name: 'Next' });
    await waitFor(() => expect(nextButton).toBeEnabled());
    fireEvent.click(nextButton);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(fetch.mock.calls[2][0]).toContain('page=2');
  });

  test('legacy membership step URLs redirect to the integrated application', async () => {
    const first = withRouter(
      <Routes>
        <Route path="/old-family" element={<StepTwo />} />
        <Route path="/old-review" element={<StepThree />} />
        <Route path="/luxury-membership" element={<p>Membership application</p>} />
      </Routes>,
      '/old-family',
    );
    await waitFor(() => expect(screen.getByText('Membership application')).toBeInTheDocument());
    first.unmount();
    withRouter(
      <Routes>
        <Route path="/old-review" element={<StepThree />} />
        <Route path="/luxury-membership" element={<p>Membership application</p>} />
      </Routes>,
      '/old-review',
    );
    await waitFor(() => expect(screen.getByText('Membership application')).toBeInTheDocument());
  });
});
