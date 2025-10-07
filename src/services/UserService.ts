import { User, Payment, Session } from '../models';
import mongoose from 'mongoose';

class UserService {
  private static instance: UserService;

  private constructor() {}

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  public async getAllUsers(
    page: number = 1,
    limit: number = 10,
    search: string = '',
    status: 'active' | 'inactive' | 'suspended' | 'all' = 'all'
  ) {
    const query: any = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { macAddress: { $regex: search, $options: 'i' } },
      ];
    }
    if (status !== 'all') {
      query.status = status;
    }

    const users = await User.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-password -twoFactorSecret'); // Exclude sensitive fields
    const totalUsers = await User.countDocuments(query);

    return {
      users,
      totalUsers,
      page,
      limit,
      totalPages: Math.ceil(totalUsers / limit),
    };
  }

  public async getUserById(userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid User ID');
    }
    const user = await User.findById(userId).select('-password -twoFactorSecret');
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  public async createUser(userData: any) {
    console.log('Received user data for creation:', userData);
    const newUser = new User(userData);
    await newUser.save();
    return newUser.toObject();
  }

  public async updateUser(userId: string, updateData: any) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid User ID');
    }
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-password -twoFactorSecret');
    if (!updatedUser) {
      throw new Error('User not found');
    }
    return updatedUser;
  }

  public async deleteUser(userId: string) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid User ID');
    }
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      throw new Error('User not found');
    }
    return { message: 'User deleted successfully' };
  }

  public async toggleUserStatus(userId: string, status: 'active' | 'inactive' | 'suspended') {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid User ID');
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    user.status = status;
    await user.save();
    return user.toObject();
  }

  public async getUserPaymentHistory(userId: string, page: number = 1, limit: number = 10) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid User ID');
    }
    const payments = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const totalPayments = await Payment.countDocuments({ userId });

    return {
      payments,
      totalPayments,
      page,
      limit,
      totalPages: Math.ceil(totalPayments / limit),
    };
  }

  public async getUserSessionHistory(userId: string, page: number = 1, limit: number = 10) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid User ID');
    }
    const sessions = await Session.find({ userId })
      .sort({ startTime: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const totalSessions = await Session.countDocuments({ userId });

    return {
      sessions,
      totalSessions,
      page,
      limit,
      totalPages: Math.ceil(totalSessions / limit),
    };
  }
}

export default UserService;