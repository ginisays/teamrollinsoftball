import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { familyAccounts } from "../../db/schema.js";

type UserDeletedEvent = {
  user: { id: string };
};

export default {
  async userDeleted(event: UserDeletedEvent) {
    await db
      .delete(familyAccounts)
      .where(eq(familyAccounts.identityUserId, event.user.id));
  },
};
