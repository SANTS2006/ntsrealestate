import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { UserAvatar } from '../ui/UserAvatar.jsx';
import { documentsApi } from '../../api/documents.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

const ACCEPT = '.jpg,.jpeg,.png,.webp';

export function ProfilePictureCard() {
  const { user, avatarVersion, bumpAvatarVersion } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await documentsApi.uploadAvatar(file);
      bumpAvatarVersion();
    } catch (err) {
      setError(err.details?.map((d) => d.message).join(' ') || err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Profile photo</h2>
      </CardHeader>
      <CardBody>
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        <div className="flex items-center gap-4">
          <div className="relative">
            <UserAvatar user={user} size={72} refreshKey={avatarVersion} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change profile photo"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-white hover:bg-brand-700 dark:border-slate-900"
            >
              <Camera size={13} aria-hidden="true" />
            </button>
          </div>
          <div>
            <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleFileChange} />
            <Button type="button" variant="secondary" size="sm" loading={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? 'Uploading…' : 'Change photo'}
            </Button>
            <p className="mt-1.5 text-xs text-slate-400">JPG, PNG, or WEBP up to 10MB</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
