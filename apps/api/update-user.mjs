import { PrismaClient } from './src/generated/prisma/index.js';
const p = new PrismaClient();
async function main() {
  try {
    const email = 'arianit.sheholli@gmail.com';
    const u = await p.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerified: true }
    });
    console.log('Found:', u);
    if (u && !u.emailVerified) {
      const upd = await p.user.update({
        where: { email },
        data: { emailVerified: true },
        select: { email: true, emailVerified: true }
      });
      console.log('Updated:', upd);
    } else if (u && u.emailVerified) {
      console.log('User already verified.');
    } else {
       console.log('User not found.');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await p.$disconnect();
  }
}
main();
