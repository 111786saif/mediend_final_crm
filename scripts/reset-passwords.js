const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetPasswords() {
  const password = '12345678';
  const passwordHash = await bcrypt.hash(password, 10);

  console.log('Resetting passwords for employees 2563 and 2566...');
  console.log('New password hash:', passwordHash);

  const result = await prisma.user.updateMany({
    where: {
      employee: {
        employeeCode: {
          in: ['2563', '2566'],
        },
      },
    },
    data: {
      passwordHash: passwordHash,
    },
  });

  console.log(`Updated ${result.count} users`);

  // Verify
  const users = await prisma.user.findMany({
    where: {
      employee: {
        employeeCode: {
          in: ['2563', '2566'],
        },
      },
    },
    include: {
      employee: {
        select: {
          employeeCode: true,
        },
      },
    },
  });

  console.log('\nVerification:');
  for (const user of users) {
    console.log(`${user.employee?.employeeCode}: ${user.email} - hash set: ${user.passwordHash ? 'YES' : 'NO'}`);
  }

  await prisma.$disconnect();
}

resetPasswords().catch((e) => {
  console.error(e);
  process.exit(1);
});
