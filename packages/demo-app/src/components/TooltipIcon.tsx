import React, { useState } from 'react';
import { QuestionCircleOutlined } from '@ant-design/icons';
interface TooltipIconProps {
  /** 提示内容 */
  content: React.ReactNode;
  /** 图标 */
  icon?: JSX.Element | string;
  /** 提示框位置 */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** 自定义样式 */
  style?: React.CSSProperties;
}

export const TooltipIcon: React.FC<TooltipIconProps> = ({
  content,
  icon = <QuestionCircleOutlined />,
  position = 'bottom',
  style
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const handleMouseEnter = () => {
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <div
      className="tooltip-icon-container"
      style={{
        position: 'relative',
        display: 'inline-block',
        marginLeft: '8px',
        cursor: 'help',
        ...style
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span
        className="tooltip-icon"
        style={{
          display: 'inline-block',
          fontSize: '14px',
          color: '#999',
          transition: 'color 0.2s',
        }}
      >
        {icon}
      </span>
      
      {isVisible && (
        <div
          className={`tooltip-content tooltip-${position}`}
          style={{
            position: 'absolute',
            backgroundColor: '#333',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            // 根据位置调整样式
            ...(position === 'bottom' && {
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '4px'
            }),
            ...(position === 'top' && {
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '4px'
            }),
            ...(position === 'right' && {
              left: '100%',
              top: '50%',
              transform: 'translateY(-50%)',
              marginLeft: '4px'
            }),
            ...(position === 'left' && {
              right: '100%',
              top: '50%',
              transform: 'translateY(-50%)',
              marginRight: '4px'
            })
          }}
        >
          {content}
          
          {/* 箭头 */}
          <div
            style={{
              position: 'absolute',
              width: 0,
              height: 0,
              ...(position === 'bottom' && {
                top: '-4px',
                left: '50%',
                transform: 'translateX(-50%)',
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderBottom: '4px solid #333'
              }),
              ...(position === 'top' && {
                bottom: '-4px',
                left: '50%',
                transform: 'translateX(-50%)',
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: '4px solid #333'
              }),
              ...(position === 'right' && {
                left: '-4px',
                top: '50%',
                transform: 'translateY(-50%)',
                borderTop: '4px solid transparent',
                borderBottom: '4px solid transparent',
                borderRight: '4px solid #333'
              }),
              ...(position === 'left' && {
                right: '-4px',
                top: '50%',
                transform: 'translateY(-50%)',
                borderTop: '4px solid transparent',
                borderBottom: '4px solid transparent',
                borderLeft: '4px solid #333'
              })
            }}
          />
        </div>
      )}
    </div>
  );
};