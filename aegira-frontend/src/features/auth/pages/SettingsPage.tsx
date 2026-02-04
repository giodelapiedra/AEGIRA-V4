import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Mail, Building2, Clock, User as UserIcon, CheckCircle, Cake, Pencil, Camera, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/lib/hooks/use-auth';
import { useToast } from '@/lib/hooks/use-toast';
import { useChangePassword } from '../hooks/useChangePassword';
import { useUpdateProfile } from '../hooks/useUpdateProfile';
import { useUploadAvatar } from '../hooks/useUploadAvatar';
import { useAuthStore } from '@/stores/auth.store';
import { ROLE_LABELS } from '@/lib/utils/format.utils';

// --- Password change schema ---
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

// --- Profile edit schema ---
const editProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100).trim(),
  lastName: z.string().min(1, 'Last name is required').max(100).trim(),
  gender: z.string(),
  dateOfBirth: z.string(),
});

type EditProfileForm = z.infer<typeof editProfileSchema>;

// --- Helpers ---
function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// --- Reusable info display ---
interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAvatarMutation = useUploadAvatar();

  // Password change form
  const changePasswordMutation = useChangePassword();
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Profile edit form
  const updateProfileMutation = useUpdateProfile();
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
    setValue: setProfileValue,
    watch: watchProfile,
    formState: { errors: profileErrors },
  } = useForm<EditProfileForm>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      gender: user?.gender || '',
      dateOfBirth: user?.dateOfBirth || '',
    },
  });

  const selectedGender = watchProfile('gender');

  const onPasswordSubmit = async (data: ChangePasswordForm) => {
    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast({ title: 'Password updated', description: 'Your password has been changed successfully.' });
      resetPassword();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Password update failed',
        description: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  };

  const onProfileSubmit = async (data: EditProfileForm) => {
    if (!user) return;

    const gender = (data.gender as 'MALE' | 'FEMALE') || null;
    const dateOfBirth = data.dateOfBirth || null;

    // Only send fields that actually changed
    const updates = {
      ...(data.firstName !== user.firstName && { firstName: data.firstName }),
      ...(data.lastName !== user.lastName && { lastName: data.lastName }),
      ...(gender !== (user.gender || null) && { gender }),
      ...(dateOfBirth !== (user.dateOfBirth || null) && { dateOfBirth }),
    };

    if (Object.keys(updates).length === 0) {
      toast({ title: 'No changes', description: 'No modifications were detected.' });
      setIsEditing(false);
      return;
    }

    try {
      await updateProfileMutation.mutateAsync(updates);
      // Update the auth store with new profile data
      setAuth({
        ...user,
        firstName: data.firstName,
        lastName: data.lastName,
        gender,
        dateOfBirth,
      });
      toast({ title: 'Profile updated', description: 'Your profile has been updated successfully.' });
      setIsEditing(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Profile update failed',
        description: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  };

  const handleStartEdit = () => {
    resetProfile({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      gender: user?.gender || '',
      dateOfBirth: user?.dateOfBirth || '',
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    resetProfile();
    setIsEditing(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be selected again
    e.target.value = '';

    // Client-side validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Only JPEG, PNG, and WebP images are allowed.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'File size must not exceed 5MB.' });
      return;
    }

    try {
      const data = await uploadAvatarMutation.mutateAsync(file);
      if (user) {
        setAuth({ ...user, profilePictureUrl: data.profilePictureUrl });
      }
      toast({ title: 'Profile picture updated', description: 'Your profile picture has been updated successfully.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  };

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : '';

  const genderDisplay = user?.gender === 'MALE' ? 'Male' : user?.gender === 'FEMALE' ? 'Female' : 'Not set';
  const ageDisplay = user?.dateOfBirth ? `${calculateAge(user.dateOfBirth)} years old` : 'Not set';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account and preferences"
      />

      {/* Profile Card */}
      <Card className="overflow-hidden">
        <div className="flex flex-col md:flex-row">
          {/* Left - Avatar & Identity */}
          <div className="flex flex-col items-center justify-center gap-3 border-b md:border-b-0 md:border-r p-8 md:w-64 shrink-0 bg-muted/30">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={handleAvatarClick}
              className="relative group cursor-pointer rounded-full"
              disabled={uploadAvatarMutation.isPending}
            >
              <Avatar className="h-24 w-24 text-2xl">
                {user?.profilePictureUrl && (
                  <AvatarImage src={user.profilePictureUrl} alt={`${user.firstName} ${user.lastName}`} />
                )}
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover:bg-black/40 transition-colors">
                {uploadAvatarMutation.isPending ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </button>
            <div className="text-center">
              <h3 className="text-lg font-semibold">
                {user?.firstName} {user?.lastName}
              </h3>
              <Badge variant="secondary" className="mt-1.5">
                {user?.role ? ROLE_LABELS[user.role] : ''}
              </Badge>
            </div>
          </div>

          {/* Right - Info sections or Edit form */}
          <div className="flex-1 p-6">
            {!isEditing ? (
              <>
                {/* View mode */}
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Account Information
                  </p>
                  <Button variant="ghost" size="sm" onClick={handleStartEdit}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Edit Profile
                  </Button>
                </div>
                <div className="flex flex-wrap gap-x-10 gap-y-4 py-3">
                  <InfoItem
                    icon={<Mail className="h-4 w-4" />}
                    label="Email"
                    value={user?.email || ''}
                  />
                  <InfoItem
                    icon={<UserIcon className="h-4 w-4" />}
                    label="Role"
                    value={user?.role ? ROLE_LABELS[user.role] : ''}
                  />
                </div>

                <Separator />

                <div className="py-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Personal Information
                  </p>
                  <div className="flex flex-wrap gap-x-10 gap-y-4">
                    <InfoItem
                      icon={<UserIcon className="h-4 w-4" />}
                      label="Gender"
                      value={genderDisplay}
                    />
                    <InfoItem
                      icon={<Cake className="h-4 w-4" />}
                      label="Age"
                      value={ageDisplay}
                    />
                  </div>
                </div>

                <Separator />

                <div className="py-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Company
                  </p>
                  <div className="flex flex-wrap gap-x-10 gap-y-4">
                    <InfoItem
                      icon={<Building2 className="h-4 w-4" />}
                      label="Company Name"
                      value={user?.companyName || ''}
                    />
                    <InfoItem
                      icon={<Clock className="h-4 w-4" />}
                      label="Timezone"
                      value={user?.companyTimezone || 'Asia/Manila'}
                    />
                  </div>
                </div>
              </>
            ) : (
              /* Edit mode */
              <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Edit Profile
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="Enter first name"
                      {...registerProfile('firstName')}
                    />
                    {profileErrors.firstName && (
                      <p className="text-sm text-destructive">{profileErrors.firstName.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Enter last name"
                      {...registerProfile('lastName')}
                    />
                    {profileErrors.lastName && (
                      <p className="text-sm text-destructive">{profileErrors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select
                      value={selectedGender}
                      onValueChange={(value) => setProfileValue('gender', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      {...registerProfile('dateOfBirth')}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={updateProfileMutation.isPending}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </Card>

      {/* Security Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Update your password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="max-w-md space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="Enter current password"
                autoComplete="current-password"
                {...registerPassword('currentPassword')}
              />
              {passwordErrors.currentPassword && (
                <p className="text-sm text-destructive">{passwordErrors.currentPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                autoComplete="new-password"
                {...registerPassword('newPassword')}
              />
              {passwordErrors.newPassword && (
                <p className="text-sm text-destructive">{passwordErrors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                autoComplete="new-password"
                {...registerPassword('confirmPassword')}
              />
              {passwordErrors.confirmPassword && (
                <p className="text-sm text-destructive">{passwordErrors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" disabled={isPasswordSubmitting || changePasswordMutation.isPending}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
