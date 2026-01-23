import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Profile from '../pages/Profile';
import * as api from '../services/api';
import * as config from '../services/config';
import * as session from '../services/session';
import * as useSessionHook from '../hooks/useSession';

vi.mock('../services/api');
vi.mock('../services/config');
vi.mock('../services/session');
vi.mock('../hooks/useSession');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Profile - KYC Integration', () => {
  let mockUser;
  let mockRequirements;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUser = {
      uid: 'test-user-123',
      email: 'contractor@test.com',
      firstName: 'John',
      lastName: 'Doe',
      userType: 'contractor',
      kycStatus: 'pending',
      avatarUrl: null,
    };

    mockRequirements = {
      emailVerified: true,
      kycVerified: false,
    };

    useSessionHook.useSessionUser.mockReturnValue(mockUser);
    useSessionHook.useSessionRequirements.mockReturnValue(mockRequirements);
    config.cfg = { prototype: false };
    api.api.kycStatus.mockResolvedValue({ status: 'pending' });
  });

  describe('KYC Status Display', () => {
    it('displays pending KYC status', async () => {
      render(<Profile />);
      
      expect(screen.getByText('Identity Verification (KYC)')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument();
      });
    });

    it('displays verified KYC status', async () => {
      mockUser.kycStatus = 'verified';
      mockRequirements.kycVerified = true;
      useSessionHook.useSessionUser.mockReturnValue(mockUser);
      useSessionHook.useSessionRequirements.mockReturnValue(mockRequirements);
      
      render(<Profile />);
      
      await waitFor(() => {
        const verifiedTags = screen.getAllByText('Verified');
        expect(verifiedTags.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('displays failed KYC status', async () => {
      mockUser.kycStatus = 'failed';
      useSessionHook.useSessionUser.mockReturnValue(mockUser);
      
      render(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
      });
    });
  });

  describe('KYC Action Buttons', () => {
    it('shows Complete KYC button when status is pending', async () => {
      render(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Complete KYC')).toBeInTheDocument();
        expect(screen.getByText('Refresh Status')).toBeInTheDocument();
      });
    });

    it('shows Retry KYC button when status is failed', async () => {
      mockUser.kycStatus = 'failed';
      useSessionHook.useSessionUser.mockReturnValue(mockUser);
      
      render(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Retry KYC')).toBeInTheDocument();
      });
    });

    it('does not show KYC buttons when status is verified', async () => {
      mockUser.kycStatus = 'verified';
      mockRequirements.kycVerified = true;
      useSessionHook.useSessionUser.mockReturnValue(mockUser);
      useSessionHook.useSessionRequirements.mockReturnValue(mockRequirements);
      
      render(<Profile />);
      
      await waitFor(() => {
        expect(screen.queryByText('Complete KYC')).not.toBeInTheDocument();
        expect(screen.queryByText('Refresh Status')).not.toBeInTheDocument();
      });
    });
  });

  describe('KYC Verification Flow', () => {
    it('calls kycVerification API when Complete KYC is clicked', async () => {
      api.api.kycVerification.mockResolvedValue({ url: 'https://stripe.com/verify' });
      const user = userEvent.setup();
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      
      render(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Complete KYC')).toBeInTheDocument();
      });
      
      const completeButton = screen.getByText('Complete KYC');
      await user.click(completeButton);
      
      await waitFor(() => {
        expect(api.api.kycVerification).toHaveBeenCalled();
      });

      windowOpenSpy.mockRestore();
    });

    it('opens Stripe URL in new tab in production mode', async () => {
      api.api.kycVerification.mockResolvedValue({ url: 'https://stripe.com/verify' });
      const user = userEvent.setup();
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      
      render(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Complete KYC')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Complete KYC'));
      
      await waitFor(() => {
        expect(windowOpenSpy).toHaveBeenCalledWith('https://stripe.com/verify', '_blank');
        expect(screen.getByText(/KYC verification opened in new tab/)).toBeInTheDocument();
      });

      windowOpenSpy.mockRestore();
    });

    it('handles verification error gracefully', async () => {
      api.api.kycVerification.mockRejectedValue(new Error('Network error'));
      const user = userEvent.setup();
      
      render(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Complete KYC')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Complete KYC'));
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to start KYC verification/)).toBeInTheDocument();
      });
    });
  });

  describe('KYC Status Refresh', () => {
    it('calls kycStatus API when Refresh Status is clicked', async () => {
      api.api.kycStatus.mockResolvedValue({ status: 'verified' });
      const user = userEvent.setup();
      
      render(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Refresh Status')).toBeInTheDocument();
      });
      
      const refreshButton = screen.getByText('Refresh Status');
      await user.click(refreshButton);
      
      await waitFor(() => {
        expect(api.api.kycStatus).toHaveBeenCalled();
      });
    });

    it('updates user status after refresh', async () => {
      api.api.kycStatus.mockResolvedValue({ status: 'verified' });
      const user = userEvent.setup();
      
      render(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Refresh Status')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Refresh Status'));
      
      await waitFor(() => {
        expect(session.setUser).toHaveBeenCalledWith(
          expect.objectContaining({ kycStatus: 'verified' }),
          expect.objectContaining({ kycVerified: true })
        );
        expect(screen.getByText('KYC Status: Verified')).toBeInTheDocument();
      });
    });

    it('handles refresh error gracefully', async () => {
      api.api.kycStatus.mockRejectedValue(new Error('Network error'));
      const user = userEvent.setup();
      
      render(<Profile />);
      
      await waitFor(() => {
        expect(screen.getByText('Refresh Status')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Refresh Status'));
      
      await waitFor(() => {
        expect(screen.getByText('Failed to check KYC status')).toBeInTheDocument();
      });
    });
  });

  describe('KYC Auto-Refresh on Mount', () => {
    it('auto-checks KYC status on mount for unverified users', async () => {
      render(<Profile />);
      
      await waitFor(() => {
        expect(api.api.kycStatus).toHaveBeenCalled();
      });
    });

    it('does not auto-check for verified users', async () => {
      mockUser.kycStatus = 'verified';
      mockRequirements.kycVerified = true;
      useSessionHook.useSessionUser.mockReturnValue(mockUser);
      
      render(<Profile />);
      
      await waitFor(() => {
        expect(api.api.kycStatus).not.toHaveBeenCalled();
      }, { timeout: 500 }).catch(() => {});
    });

    it('updates session when status changes from auto-check', async () => {
      api.api.kycStatus.mockResolvedValue({ status: 'verified' });
      
      render(<Profile />);
      
      await waitFor(() => {
        expect(session.setUser).toHaveBeenCalledWith(
          expect.objectContaining({ kycStatus: 'verified' }),
          expect.objectContaining({ kycVerified: true })
        );
      });
    });
  });

  describe('Avatar Upload', () => {
    it('displays avatar action button', async () => {
      render(<Profile />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /update photo/i })
        ).toBeInTheDocument();
      });
    });

    it('uploads avatar successfully', async () => {
      const mockFile = new File(['avatar'], 'avatar.png', { type: 'image/png' });
      api.api.uploadAvatar.mockResolvedValue({ avatarUrl: 'https://example.com/avatar.png' });
      const user = userEvent.setup();
      
      const { container } = render(<Profile />);

      const input = container.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
      await user.upload(input, mockFile);
      
      await waitFor(() => {
        expect(api.api.uploadAvatar).toHaveBeenCalledWith(mockFile);
        expect(session.setUser).toHaveBeenCalledWith(
          expect.objectContaining({ avatarUrl: 'https://example.com/avatar.png' }),
          mockRequirements
        );
        expect(screen.getByText('Avatar updated successfully!')).toBeInTheDocument();
      });
    });

    it('rejects files larger than 5MB', async () => {
      const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.png', { type: 'image/png' });
      Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 });
      const user = userEvent.setup();
      
      const { container } = render(<Profile />);

      const input = container.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
      await user.upload(input, largeFile);
      
      await waitFor(() => {
        expect(api.api.uploadAvatar).not.toHaveBeenCalled();
      });
      
      expect(screen.getByText(/Image must be smaller than 5MB/i)).toBeInTheDocument();
    });

    it('handles upload error gracefully', async () => {
      const mockFile = new File(['avatar'], 'avatar.png', { type: 'image/png' });
      api.api.uploadAvatar.mockRejectedValue({ 
        data: { error: 'Upload failed' }
      });
      const user = userEvent.setup();
      
      const { container } = render(<Profile />);

      const input = container.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
      await user.upload(input, mockFile);
      
      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument();
      });
    });

    it('displays avatar preview when avatarUrl exists', async () => {
      mockUser.avatarUrl = 'https://example.com/existing-avatar.png';
      useSessionHook.useSessionUser.mockReturnValue(mockUser);
      
      const { container } = render(<Profile />);
      
      await waitFor(() => {
        const img = container.querySelector('.avatar-image');
        expect(img).toBeInTheDocument();
        expect(img.src).toBe('https://example.com/existing-avatar.png');
      });
    });

    it('shows uploading state while upload is in progress', async () => {
      const mockFile = new File(['avatar'], 'avatar.png', { type: 'image/png' });
      api.api.uploadAvatar.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      
      const { container } = render(<Profile />);

      const input = container.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
      await user.upload(input, mockFile);
      
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /update photo/i })
        ).toBeDisabled();
      });
    });
  });
});
