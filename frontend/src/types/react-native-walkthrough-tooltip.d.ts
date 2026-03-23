declare module 'react-native-walkthrough-tooltip' {
    import React from 'react';
    interface TooltipProps {
        isVisible?: boolean;
        content?: React.ReactNode;
        placement?: string;
        onClose?: () => void;
        children?: React.ReactNode;
        [key: string]: any;
    }
    const Tooltip: React.FC<TooltipProps>;
    export default Tooltip;
}
