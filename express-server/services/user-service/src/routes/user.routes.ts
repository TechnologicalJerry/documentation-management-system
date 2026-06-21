import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { uploadAvatarMiddleware } from '../middleware/upload.middleware';

const router = Router();
const controller = new UserController();

/**
 * @route   GET /api/v1/users
 * @desc    List users with pagination and filtering
 * @access  Internal
 */
router.get('/', controller.getUsers);

/**
 * @route   GET /api/v1/users/search
 * @desc    Full-text search users
 * @access  Internal
 */
router.get('/search', controller.searchUsers);

/**
 * @route   GET /api/v1/users/email/:email
 * @desc    Get user by email address
 * @access  Internal
 */
router.get('/email/:email', controller.getUserByEmail);

/**
 * @route   POST /api/v1/users
 * @desc    Create a user profile (called by auth-service)
 * @access  Internal
 */
router.post('/', controller.createUser);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Internal
 */
router.get('/:id', controller.getUserById);

/**
 * @route   PATCH /api/v1/users/:id
 * @desc    Update user profile
 * @access  Internal
 */
router.patch('/:id', controller.updateUser);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Soft-delete user
 * @access  Internal
 */
router.delete('/:id', controller.deleteUser);

/**
 * @route   POST /api/v1/users/:id/avatar
 * @desc    Upload user avatar
 * @access  Internal
 */
router.post('/:id/avatar', uploadAvatarMiddleware, controller.uploadAvatar);

/**
 * @route   DELETE /api/v1/users/:id/avatar
 * @desc    Remove user avatar
 * @access  Internal
 */
router.delete('/:id/avatar', controller.removeAvatar);

/**
 * @route   GET /api/v1/users/:id/preferences
 * @desc    Get user preferences
 * @access  Internal
 */
router.get('/:id/preferences', controller.getPreferences);

/**
 * @route   PATCH /api/v1/users/:id/preferences
 * @desc    Update user preferences
 * @access  Internal
 */
router.patch('/:id/preferences', controller.updatePreferences);

export { router as userRouter };
