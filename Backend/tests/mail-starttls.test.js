// This isolated suite proves that port 587 uses STARTTLS instead of implicit TLS.
process.env.SMTP_PORT = '587';

const { sendMail } = await import('../src/services/mail.service.js');
const nodemailer = (await import('nodemailer')).default;

test('SMTP port 587 creates a non-secure STARTTLS transporter', async () => {
  await sendMail({
    to: 'member@example.invalid',
    subject: 'Test',
    template: 'activation',
    data: { link: '' },
  });
  expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
    port: 587,
    secure: false,
  }));
});
