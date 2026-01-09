const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class AuthController {
    async login(req, res) {
        try {
            const { email, password } = req.body;

            // Find user by email
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Check if user is active
            if (!user.isActive) {
                return res.status(401).json({ error: 'Account is deactivated' });
            }

            // Check password
            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Update last login
            user.lastLogin = new Date();
            await user.save();

            // Generate JWT token
            const token = jwt.sign(
                {
                    _id: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE }
            );

            // Remove password from response
            const userResponse = user.toObject();
            delete userResponse.password;

            res.json({
                success: true,
                message: 'Login successful',
                token,
                user: userResponse
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getProfile(req, res) {
        try {
            const user = await User.findById(req.user._id).select('-password');
            res.json({
                success: true,
                user
            });
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async updateProfile(req, res) {
        try {
            const { name, phone } = req.body;
            const user = await User.findById(req.user._id);

            if (name) user.name = name;
            if (phone) user.phone = phone;

            await user.save();

            // Remove password from response
            const userResponse = user.toObject();
            delete userResponse.password;

            res.json({
                success: true,
                message: 'Profile updated successfully',
                user: userResponse
            });

        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const user = await User.findById(req.user._id);

            // Check current password
            const isPasswordValid = await user.comparePassword(currentPassword);
            if (!isPasswordValid) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }

            // Update password
            user.password = newPassword;
            await user.save();

            res.json({
                success: true,
                message: 'Password changed successfully'
            });

        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async register(req, res) {
        try {
            const { name, email, password, phone, role = 'sales' } = req.body;

            // Check if user already exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ error: 'User already exists' });
            }

            // Create new user
            const user = new User({
                name,
                email,
                password,
                phone,
                role,
                isActive: true
            });

            await user.save();

            // Remove password from response
            const userResponse = user.toObject();
            delete userResponse.password;

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                user: userResponse
            });

        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getUsers(req, res) {
        try {
            const users = await User.find().select('-password').sort({ createdAt: -1 });
            res.json({
                success: true,
                users
            });
        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getUser(req, res) {
        try {
            const user = await User.findById(req.params.id).select('-password');
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({
                success: true,
                user
            });

        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async updateUser(req, res) {
        try {
            const { name, email, phone, role, isActive } = req.body;
            const user = await User.findById(req.params.id);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Prevent self-deactivation
            if (user._id.toString() === req.user._id && isActive === false) {
                return res.status(400).json({ error: 'Cannot deactivate your own account' });
            }

            if (name) user.name = name;
            if (email) user.email = email;
            if (phone) user.phone = phone;
            if (role) user.role = role;
            if (isActive !== undefined) user.isActive = isActive;

            await user.save();

            // Remove password from response
            const userResponse = user.toObject();
            delete userResponse.password;

            res.json({
                success: true,
                message: 'User updated successfully',
                user: userResponse
            });

        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async deleteUser(req, res) {
        try {
            const user = await User.findById(req.params.id);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Prevent self-deletion
            if (user._id.toString() === req.user._id) {
                return res.status(400).json({ error: 'Cannot delete your own account' });
            }

            await user.deleteOne();

            res.json({
                success: true,
                message: 'User deleted successfully'
            });

        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async toggleUserStatus(req, res) {
        try {
            const { isActive } = req.body;
            const user = await User.findById(req.params.id);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Prevent self-deactivation
            if (user._id.toString() === req.user._id && isActive === false) {
                return res.status(400).json({ error: 'Cannot deactivate your own account' });
            }

            user.isActive = isActive;
            await user.save();

            res.json({
                success: true,
                message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
            });

        } catch (error) {
            console.error('Toggle user status error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async resetPassword(req, res) {
        try {
            const user = await User.findById(req.params.id);

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Generate temporary password
            const tempPassword = Math.random().toString(36).slice(-8);
            user.password = tempPassword;
            await user.save();

            // In production, you would send this via email/SMS
            // For now, return it in response (in production, remove this)
            res.json({
                success: true,
                message: 'Password reset successfully',
                temporaryPassword: tempPassword // Remove this in production
            });

        } catch (error) {
            console.error('Reset password error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = new AuthController();
