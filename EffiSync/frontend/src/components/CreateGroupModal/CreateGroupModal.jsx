import { useState, useRef, useEffect } from 'react';
import './CreateGroupModal.scss';

const GROUP_TYPES = ['Household', 'Friend Group', 'Work Environment'];

function CreateGroupModal({ isOpen, onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', type: 'Household', description: '' });
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setForm({ name: '', type: 'Household', description: '' });
      setImageFile(null);
      setImagePreview(null);
      setImageError('');
      setShowTypeDropdown(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setImageError('Invalid format. Use JPEG, PNG, WEBP, or GIF.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image must be under 5MB.');
      return;
    }

    setImageError('');
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onCreate({
      ...form,
      id: `g-${Date.now()}`,
      image: imagePreview,
      members: ['1']
    });
    onClose();
  };

  return (
    <div className="create-group__overlay" onClick={onClose}>
      <div className="create-group" onClick={e => e.stopPropagation()}>
        <div className="create-group__top">
          <div className="create-group__left">
            <div className="create-group__title-row">
              <div className="create-group__field">
                <label className="create-group__label">Group Title</label>
                <input className="create-group__input" type="text" placeholder="Enter group name"
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})} autoFocus />
              </div>
              <div className="create-group__type-wrapper">
                <button className="create-group__type-btn"
                  onClick={() => setShowTypeDropdown(!showTypeDropdown)}>
                  {form.type} ▾
                </button>
                {showTypeDropdown && (
                  <div className="create-group__type-dropdown">
                    {GROUP_TYPES.map(t => (
                      <button key={t} className="create-group__type-option"
                        onClick={() => { setForm({...form, type: t}); setShowTypeDropdown(false); }}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="create-group__field">
              <label className="create-group__label">Group Description</label>
              <textarea className="create-group__input create-group__textarea"
                placeholder="What's this group about?" rows={4}
                value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
          </div>
          <div className="create-group__right">
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/jpeg, image/png, image/webp, image/gif"
              onChange={handleImageChange}
            />
            <div className="create-group__image-holder" onClick={handleImageClick}>
              {imagePreview ? (
                <img src={imagePreview} alt="Group preview" className="create-group__image-preview" />
              ) : (
                <>
                  <span className="create-group__image-text">Group Image</span>
                  <span className="create-group__image-icon">📷</span>
                </>
              )}
            </div>
            {imageError && <span className="create-group__image-error">{imageError}</span>}
          </div>
        </div>
        <div className="create-group__actions">
          <button className="create-group__btn create-group__btn--cancel" onClick={onClose}>
            ✕ Cancel
          </button>
          <button className="create-group__btn create-group__btn--create" onClick={handleSubmit}>
            Create Group
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateGroupModal;
