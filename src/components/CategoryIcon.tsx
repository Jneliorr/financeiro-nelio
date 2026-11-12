import React from 'react';
import {
  Utensils,
  ShoppingCart,
  Pizza,
  Palmtree,
  Car,
  Home,
  HeartPulse,
  ShoppingBag,
  Wallet,
  BadgePercent,
  Coffee,
  Fuel,
  Plane,
  Tv,
  Smartphone,
  BookOpen,
  Dumbbell,
  Gift,
  PawPrint,
  Wrench,
  HelpCircle,
  LucideIcon,
  Tag,
  CircleDollarSign,
  TrendingDown,
  TrendingUp,
  CreditCard,
  Zap,
  Banknote,
  ArrowLeftRight,
} from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
  Utensils,
  ShoppingCart,
  Pizza,
  Palmtree,
  Car,
  Home,
  HeartPulse,
  ShoppingBag,
  Wallet,
  BadgePercent,
  Coffee,
  Fuel,
  Plane,
  Tv,
  Smartphone,
  BookOpen,
  Dumbbell,
  Gift,
  PawPrint,
  Wrench,
  Tag,
  CreditCard,
  Zap,
  Banknote,
  ArrowLeftRight,
  CircleDollarSign,
  TrendingDown,
  TrendingUp,
};

interface CategoryIconProps {
  name: string;
  className?: string;
  size?: number;
  color?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  name,
  className = '',
  size = 20,
  color,
}) => {
  const IconComponent = ICON_MAP[name] || HelpCircle;
  return <IconComponent size={size} className={className} style={color ? { color } : undefined} />;
};

export const AVAILABLE_ICONS = [
  'Utensils',
  'ShoppingCart',
  'Pizza',
  'Coffee',
  'Palmtree',
  'Car',
  'Fuel',
  'Home',
  'HeartPulse',
  'ShoppingBag',
  'Smartphone',
  'Tv',
  'BookOpen',
  'Dumbbell',
  'Gift',
  'PawPrint',
  'Wrench',
  'Plane',
  'Wallet',
  'BadgePercent',
  'Tag',
];

export const AVAILABLE_COLORS = [
  '#F97316', // Orange
  '#10B981', // Emerald
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#EAB308', // Amber
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#64748B', // Slate
];
