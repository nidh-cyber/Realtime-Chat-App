import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  addMembers,
  createGroup,
  deleteGroup,
  getGroupById,
  getGroups,
  leaveGroup,
  markGroupMessagesSeen,
  removeMember,
  sendGroupMessage,
  transferAdmin,
  updateGroup,
} from "../controllers/group.controller.js";

const router = express.Router();

router.post("/", protectRoute, createGroup);
router.get("/", protectRoute, getGroups);
router.get("/:id", protectRoute, getGroupById);
router.patch("/:id", protectRoute, updateGroup);
router.delete("/:id", protectRoute, deleteGroup);
router.post("/:id/members", protectRoute, addMembers);
router.delete("/:id/members/:userId", protectRoute, removeMember);
router.post("/:id/leave", protectRoute, leaveGroup);
router.post("/:id/transfer-admin", protectRoute, transferAdmin);
router.post("/:id/messages", protectRoute, sendGroupMessage);
router.patch("/:id/mark-seen", protectRoute, markGroupMessagesSeen);

export default router;
