import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { NotificationSettings } from './NotificationSettings';

vi.mock('@clerk/clerk-react', async () => {
  const actual = await vi.importActual('@clerk/clerk-react');
  return {
    ...(actual as object),
    useAuth: vi.fn(() => ({
      orgRole: 'org:admin',
      isSignedIn: true,
      getToken: vi.fn(() => Promise.resolve('mock-test-token')),
      sessionClaims: { platformAdmin: false },
    })),
  };
});

describe('NotificationSettings page', () => {
  it('renders "Notification Channels" heading', async () => {
    renderWithProviders(<NotificationSettings />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /notification channels/i })).toBeInTheDocument(),
    );
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/notifications', () =>
        HttpResponse.json({ error: { message: 'Notifications unavailable' } }, { status: 503 }),
      ),
    );
    renderWithProviders(<NotificationSettings />);
    await waitFor(() =>
      expect(screen.getByText('Notifications unavailable')).toBeInTheDocument(),
    );
  });

  it('renders list of notification configs with type badge', async () => {
    renderWithProviders(<NotificationSettings />);
    await waitFor(() => expect(screen.getByText('Ops Email')).toBeInTheDocument());
    expect(screen.getByText('email')).toBeInTheDocument();
  });

  it('renders "Test" button per config that calls POST /notifications/:id/test', async () => {
    let testCalled = false;
    server.use(
      http.post('*/notifications/:id/test', () => {
        testCalled = true;
        return HttpResponse.json({ sent: true, type: 'email', destination: 'ops@example.com' });
      }),
    );
    renderWithProviders(<NotificationSettings />);
    await waitFor(() => expect(screen.getByRole('button', { name: /test/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /test/i }));
    await waitFor(() => expect(testCalled).toBe(true));
  });

  it('"Add Channel" button visible to admin', async () => {
    renderWithProviders(<NotificationSettings />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /notification channels/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /add channel/i })).toBeInTheDocument();
  });

  it('form shows email input for email type', async () => {
    renderWithProviders(<NotificationSettings />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add channel/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /add channel/i }));
    await waitFor(() => expect(screen.getByLabelText(/email address/i)).toBeInTheDocument());
  });

  it('form shows URL input for webhook type', async () => {
    renderWithProviders(<NotificationSettings />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add channel/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /add channel/i }));
    // Switch to webhook type
    await waitFor(() => expect(screen.getByLabelText(/type/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'webhook' } });
    await waitFor(() => expect(screen.getByLabelText(/webhook url/i)).toBeInTheDocument());
  });

  it('events checkboxes render for all 4 valid events', async () => {
    renderWithProviders(<NotificationSettings />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /add channel/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /add channel/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/capacity_warning/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/capacity_critical/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/sla_warning/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/sla_breach/i)).toBeInTheDocument();
    });
  });
});
