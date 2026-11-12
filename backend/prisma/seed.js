import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const roleDefinitions = [
    ["administrator", "Full platform administration"],
    ["content_manager", "Movie and media management"],
    ["moderator", "Review and report moderation"],
    ["user", "Registered customer"]
  ];

  const roleMap = {};
  for (const [name, description] of roleDefinitions) {
    roleMap[name] = await prisma.role.upsert({
      where: { name },
      update: { description },
      create: { name, description }
    });
  }

  const permissionNames = [
    "manage_users", "manage_movies", "upload_movies",
    "manage_billing", "manage_plans", "view_reports", "moderate_reviews"
  ];
  const permissionMap = {};
  for (const name of permissionNames) {
    permissionMap[name] = await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name, description: `Permission: ${name}` }
    });
  }

  const assignments = {
    administrator: permissionNames,
    content_manager: ["manage_movies", "upload_movies"],
    moderator: ["moderate_reviews", "view_reports"],
    user: []
  };

  for (const [roleName, permissions] of Object.entries(assignments)) {
    for (const permissionName of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleMap[roleName].id,
            permissionId: permissionMap[permissionName].id
          }
        },
        update: {},
        create: {
          roleId: roleMap[roleName].id,
          permissionId: permissionMap[permissionName].id
        }
      });
    }
  }

  const plans = [
    {
      code: "BASIC",
      name: "Basic",
      description: "One screen for everyday movie nights.",
      maxScreens: 1,
      maxResolution: "720p",
      amount: "3.99"
    },
    {
      code: "STANDARD",
      name: "Standard",
      description: "A sharper picture for up to two screens.",
      maxScreens: 2,
      maxResolution: "1080p",
      amount: "6.99"
    },
    {
      code: "FAMILY",
      name: "Family",
      description: "Share movie time across up to four screens.",
      maxScreens: 4,
      maxResolution: "1080p",
      amount: "9.99"
    }
  ];

  for (const planData of plans) {
    const { amount, ...data } = planData;
    const plan = await prisma.plan.upsert({
      where: { code: data.code },
      update: {
        name: data.name,
        description: data.description,
        maxScreens: data.maxScreens,
        maxResolution: data.maxResolution
      },
      create: data
    });

    const priceOptions = [{ currency: "USD", amount }];
    const rwfAmount = process.env[`RWF_${data.code}_AMOUNT`]?.trim();
    if (rwfAmount) {
      const numericAmount = Number(rwfAmount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error(`RWF_${data.code}_AMOUNT must be a positive number.`);
      }
      priceOptions.push({ currency: "RWF", amount: rwfAmount });
    }

    for (const priceOption of priceOptions) {
      await prisma.planPrice.upsert({
        where: {
          planId_currency_intervalMonths: {
            planId: plan.id,
            currency: priceOption.currency,
            intervalMonths: 1
          }
        },
        update: { amount: priceOption.amount, isActive: true },
        create: {
          planId: plan.id,
          currency: priceOption.currency,
          amount: priceOption.amount,
          intervalMonths: 1
        }
      });
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword && adminPassword !== "change-this-admin-password-before-seeding") {
    if (adminPassword.length < 12) {
      throw new Error("ADMIN_PASSWORD must be at least 12 characters before creating the administrator.");
    }

    let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: adminEmail,
          fullName: "FILMORA Administrator",
          passwordHash: await argon2.hash(adminPassword, { type: argon2.argon2id }),
          roles: { create: { roleId: roleMap.administrator.id } }
        }
      });
      console.log(`Administrator created: ${adminEmail}`);
    } else {
      const assignment = await prisma.userRole.findUnique({
        where: {
          userId_roleId: { userId: admin.id, roleId: roleMap.administrator.id }
        }
      });
      if (!assignment) {
        await prisma.userRole.create({
          data: { userId: admin.id, roleId: roleMap.administrator.id }
        });
      }
      console.log(`Administrator role ensured for: ${adminEmail}. Existing password was not changed.`);
    }
  } else {
    console.log("No administrator created. Set ADMIN_EMAIL and a strong ADMIN_PASSWORD in .env, then run the seed again.");
  }

  console.log("FILMORA database seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
