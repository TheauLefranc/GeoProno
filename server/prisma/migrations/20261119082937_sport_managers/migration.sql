-- AlterTable
ALTER TABLE "User" ADD COLUMN     "managedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[];
