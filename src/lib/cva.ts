import { cn } from './cn';

type VariantOptions = Record<string, Record<string, string>>;

type VariantProps<T extends VariantOptions> = {
  [K in keyof T]?: keyof T[K];
};

type CompoundVariant<T extends VariantOptions> = Partial<VariantProps<T>> & {
  className: string;
};

export function cva<T extends VariantOptions>(
  base: string,
  options: {
    variants: T;
    defaultVariants?: VariantProps<T>;
    compoundVariants?: CompoundVariant<T>[];
  },
) {
  return (props?: VariantProps<T> & { className?: string }) => {
    const { className, ...variantProps } = props || {};

    const variantClasses = Object.keys(options.variants).map((key) => {
      const variantValue =
        variantProps[key as keyof typeof variantProps] || options.defaultVariants?.[key];
      return variantValue ? options.variants[key][variantValue as string] : '';
    });

    const compoundClasses =
      options.compoundVariants
        ?.filter((compound) => {
          return Object.entries(compound).every(([key, value]) => {
            if (key === 'className') return true;
            return (
              variantProps[key as keyof typeof variantProps] === value ||
              options.defaultVariants?.[key] === value
            );
          });
        })
        .map((c) => c.className) || [];

    return cn(base, ...variantClasses, ...compoundClasses, className);
  };
}
