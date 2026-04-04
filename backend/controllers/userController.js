import User from "../models/User.js";

// GET /api/users
export const listUsers = async (request, reply) => {
  try {
    const { page = 1, limit = 20, q } = request.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { isArchived: { $ne: true } };
    if (q) {
      filter.$or = [
        { firstName: { $regex: q, $options: "i" } },
        { lastName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }
    const users = await User.find(filter)
      .sort({ firstName: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("firstName lastName email")
      .lean();

    const transformed = users.map((u) => ({
      id: u._id,
      name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
      email: u.email,
    }));

    return { success: true, data: transformed };
  } catch (error) {
    request.log.error("listUsers error", error);
    return reply.status(500).send({
      success: false,
      message: error.message || "Failed to list users",
    });
  }
};

