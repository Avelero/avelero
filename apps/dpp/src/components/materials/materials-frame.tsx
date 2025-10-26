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
    <div className={`px-sm md:px-0 py-lg flex flex-col gap-sm${isLast ? ' pb-0' : ''}`}>
      <h6 className="type-h6" style={{ color: colors.primaryText }}>
        MATERIALS
      </h6>
      
      <div className="rounded-rounding" style={{ border: `1px solid ${colors.border}`, display: 'grid', gridTemplateColumns: 'max-content 1fr' }}>
        {materials.map((material, index) => (
          <Fragment key={`${material.type}-${material.percentage}`}>
            <div
              className="p-md type-body"
              style={{ color: colors.primaryText }}
            >
              {material.percentage}%
            </div>
            <div 
              className="py-md pr-md flex flex-col gap-xs"
              style={index !== materials.length - 1 ? { borderBottom: `1px solid ${colors.border}` } : {}}
            >
              <div className="flex items-start justify-between gap-xs">
                <span className="type-body" style={{ color: colors.primaryText }}>
                  {material.type}
                </span>
                
                {material.certification && (
                  <span
                    className="inline-flex items-center gap-micro p-micro rounded-sm"
                    style={{ backgroundColor: colors.secondaryGreen }}
                  >
                    <Icons.Check className="w-3 h-3" style={{ color: colors.primaryGreen }} />
                    <span className="type-body-xs !leading-[100%]" style={{ color: colors.primaryGreen }}>
                      Certified
                    </span>
                  </span>
                )}
              </div>
              
              <div className="type-body-xs" style={{ color: colors.secondaryText }}>
                {material.origin}
              </div>
              
              {material.certification && (
                <a
                  href={material.certificationUrl}
                  className="type-body-xs cursor-pointer"
                  style={{ color: colors.highlight }}
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
