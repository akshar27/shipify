// The only user fields that ever go to a browser. The full row also holds the password hash and the email/reset tokens.
exports.publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  isVerified: u.isVerified,
  emailVerified: u.emailVerified,
  profilePicture: u.profilePicture,
});
