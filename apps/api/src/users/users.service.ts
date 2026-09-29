import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from './user.schema.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findByUsername(username: string) {
    return this.userModel
      .findOne({ username: username.toLowerCase().trim() })
      .lean()
      .exec();
  }

  async createSeedUsers() {
    const adminUsername = 'admin';
    const viewerUsername = 'viewer';

    const existingAdmin = await this.userModel
      .findOne({ username: adminUsername })
      .exec();
    const existingViewer = await this.userModel
      .findOne({ username: viewerUsername })
      .exec();

    if (!existingAdmin) {
      await this.userModel.create({
        username: adminUsername,
        passwordHash: await bcrypt.hash('admin123', 10),
        role: 'admin',
      });
    }

    if (!existingViewer) {
      await this.userModel.create({
        username: viewerUsername,
        passwordHash: await bcrypt.hash('viewer123', 10),
        role: 'viewer',
      });
    }
  }
}
