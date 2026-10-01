import { ownUploadUrl } from './upload-url.util';

describe('ownUploadUrl', () => {
  const base = 'https://murojaatnoma.uz';
  it('keeps our own uploads', () => {
    expect(ownUploadUrl('https://murojaatnoma.uz/uploads/a1-b2.jpg', base)).toBe(
      'https://murojaatnoma.uz/uploads/a1-b2.jpg',
    );
    expect(ownUploadUrl('/uploads/x.jpg', base)).toBe('/uploads/x.jpg');
  });
  it('drops foreign hosts, escapes and junk', () => {
    expect(ownUploadUrl('https://evil.example/uploads/x.jpg', base)).toBeNull();
    expect(ownUploadUrl('/uploads/../etc/passwd', base)).toBeNull();
    expect(ownUploadUrl('data:image/png;base64,AAAA', base)).toBeNull();
    expect(ownUploadUrl('', base)).toBeNull();
    expect(ownUploadUrl(undefined, base)).toBeNull();
  });
});
