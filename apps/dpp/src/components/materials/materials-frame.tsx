import { Fragment } from 'react';
import type { ThemeConfig } from '@/types/theme-config';
import type { Material } from '@/types/dpp-data';
import { Icons } from '@v1/ui/icons';

interface Props {
  materials: Material[];
  theme: ThemeConfig;
  isLast?: boolean;
}

export function MaterialsFrame({ materials, theme, isLast = false }: Props) {
  const { colors } = theme;
  
  return (
    <div className={`mx-sm md:mx-0 mt-lg mb-lg flex flex-col gap-sm${isLast ? ' mb-0' : ''}`}>
      <h6 className="materials-card__title">
        MATERIALS
      </h6>
      
      <div className="materials-card border grid grid-cols-[max-content_1fr]">
        {materials.map((material, index) => (
          <Fragment key={`${material.type}-${material.percentage}`}>
            <div className="p-md materials-card__percentage">
              {material.percentage}%
            </div>
            <div 
              className="py-md pr-md flex flex-col gap-xs"
              style={index !== materials.length - 1 ? { borderBottom: '1px solid var(--materials-card-border-color, var(--border))' } : {}}
            >
              <div className="flex items-start justify-between gap-xs">
                <span className="materials-card__type">
                  {material.type}
                </span>
                
                {material.certification && (
                  <span className="inline-flex items-center gap-micro p-micro materials-card__certification">
                    <Icons.Check className="w-3 h-3" />
                    <span className="!leading-[100%]">
                      Certified
                    </span>
                  </span>
                )}
              </div>
              
              <div className="materials-card__origin">
                {material.origin}
              </div>
              
              {material.certification && (
                <a
                  href={material.certificationUrl}
                  className="materials-card__certification-text text-highlight cursor-pointer"
                >
                  {material.certification}
                </a>
              )}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
