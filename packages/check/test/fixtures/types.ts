export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: Date;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  publishedAt?: Date;
}

export type UserRole = "admin" | "user";
