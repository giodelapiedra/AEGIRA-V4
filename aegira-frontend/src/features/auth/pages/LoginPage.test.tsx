import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';
import { clearAuth } from '@/test/test-utils';

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('LoginPage', () => {
  beforeEach(() => {
    clearAuth();
  });

  it('renders login form correctly', () => {
    render(<LoginPage />);

    expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByText(/login to aegira/i)).toBeInTheDocument();
  });

  it('allows typing in email field', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText(/enter your email/i);
    await user.type(emailInput, 'test@example.com');

    expect(emailInput).toHaveValue('test@example.com');
  });

  it('allows typing in password field', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const passwordInput = screen.getByPlaceholderText(/enter your password/i);
    await user.type(passwordInput, 'mypassword');

    expect(passwordInput).toHaveValue('mypassword');
  });

  it('has submit button enabled by default', () => {
    render(<LoginPage />);

    const submitButton = screen.getByRole('button', { name: /login/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('form inputs have correct types', () => {
    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText(/enter your email/i);
    const passwordInput = screen.getByPlaceholderText(/enter your password/i);

    expect(emailInput).toHaveAttribute('type', 'email');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
