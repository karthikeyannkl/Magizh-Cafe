# Magizh Cafe – exact new-base user fix
Only the newly supplied user/navigation base was used. Customer changes: intro video, password login with visible LOGIN button, logout→login, Forgot Password→Admin WhatsApp, and registration password. Admin changes: remove Reset Demo, add password reset control and Admin WhatsApp setting. B5 OTP flow is untouched.

Autoplay note: muted autoplay is attempted. If a mobile browser blocks autoplay, no website can force it without a user gesture; this version uses an invisible full-screen tap fallback instead of showing a Play button.


## Latest corrections
- Admin login trims username/password and retains the default `admin / 123456` unless the Admin password was changed.
- B5 User login no longer uses OTP. It accepts B5 Member ID or registered mobile number plus the B5 password.
- On B5 login, the current B5 coin balance is copied into the active customer wallet so future B5 coin changes are reflected on the next login.
