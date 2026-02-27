import { useState, useEffect } from 'react';

export default function ImageViewer({ imageUrl, alt, onClose }) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 bg-black z-90 flex items-center justify-center"
            onClick={onClose}
        >
            <div className="relative flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                {/* Image */}
                <div
                    className="relative cursor-pointer select-none"
                    onClick={onClose}
                >
                    <img
                        src={imageUrl}
                        alt={alt}
                        className="max-w-full max-h-full object-contain"
                        draggable={false}
                        style={{ maxWidth: '100vw', maxHeight: '100vh' }}
                    />
                </div>
            </div>
        </div>
    );
}