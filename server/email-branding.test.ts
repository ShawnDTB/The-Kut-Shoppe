import { expect, it } from 'vitest';
import { brandedAccountEmail } from './email-branding';

it('keeps the security code selectable and security guidance visible without images', () => {
  const html = brandedAccountEmail('https://www.thekutshoppe.com', 'Verify your Kut Shoppe email', 'Your Kut Shoppe code is 01234567. It expires in 10 minutes. Never share this code.', '01234567');
  expect(html).toContain('>01234567</div>');
  expect(html).toContain('It expires in 10 minutes. Never share this code.');
  expect(html).not.toContain('Open your account');
  expect(html).toContain('alt="The Kut Shoppe logo"');
  expect(html).not.toContain('<script');
});
it('escapes dynamic content and never places verification codes in links', () => {
  const html = brandedAccountEmail('https://www.thekutshoppe.com', '<img onerror="bad">', 'Change requested to <script>bad</script>@example.com.', '12345678');
  expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;@example.com');
  expect(html).toContain('&lt;img onerror=&quot;bad&quot;&gt;');
  expect(html).not.toMatch(/href="[^"]*12345678/);
  expect(() => brandedAccountEmail('javascript:alert(1)', 'Title', 'Text')).toThrow();
});
