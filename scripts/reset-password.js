/**
 * Reset a single user's password to a known value.
 *
 * Usage (from project root on the server):
 *   node scripts/reset-password.js <email-or-employeeCode> [newPassword]
 *
 * Examples:
 *   node scripts/reset-password.js vishal.sharma@mediend.com
 *   node scripts/reset-password.js 2563
 *   node scripts/reset-password.js vishal.sharma@mediend.com MyNewPass123
 *
 * If newPassword is omitted it defaults to 12345678.
 */
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const identifier = process.argv[2];
  const password = process.argv[3] || '12345678';

  if (!identifier) {
    console.error('Usage: node scripts/reset-password.js <email-or-employeeCode> [newPassword]');
    process.exit(1);
  }

  const isEmail = identifier.includes('@');

  // Locate the user by email, or via the linked employee's employeeCode.
  const user = await prisma.user.findFirst({
    where: isEmail
      ? { email: identifier.toLowerCase().trim() }
      : { employee: { employeeCode: identifier.trim() } },
    include: { employee: { select: { employeeCode: true, name: true } } },
  });

  if (!user) {
    console.error(`No user found for "${identifier}".`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  console.log('Password reset successful:');
  console.log(`  Name:         ${user.name}`);
  console.log(`  Email:        ${user.email}`);
  console.log(`  EmployeeCode: ${user.employee?.employeeCode ?? '(no linked employee)'}`);
  console.log(`  New password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
