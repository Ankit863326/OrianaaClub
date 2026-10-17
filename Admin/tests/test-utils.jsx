import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Wrap page tests in an in-memory router so links never navigate the real browser.
export function renderWithRouter(ui, { route = '/' } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}
