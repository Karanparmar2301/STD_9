import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import './ImageCropModal.css';

/**
 * ImageCropModal - Professional Image Cropper
 * 
 * Features:
 * - Drag to reposition
 * - Zoom slider control
 * - Circular preview
 * - Full control before saving
 */
function ImageCropModal({ isOpen, onClose, imageSrc, onCropComplete }) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropChange = (crop) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom) => {
        setZoom(zoom);
    };

    const onCropCompleteCallback = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createCroppedImage = async () => {
        setIsProcessing(true);
        try {
            const croppedImageBlob = await getCroppedImg(
                imageSrc,
                croppedAreaPixels,
                0 // rotation
            );
            onCropComplete(croppedImageBlob);
            onClose();
        } catch (error) {
            console.error('Crop error:', error);
            alert('Failed to crop image');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancel = () => {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div 
                className="crop-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCancel}
            >
                <motion.div 
                    className="crop-modal-content"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="crop-modal-header">
                        <h3>Adjust Your Photo</h3>
                        <button className="close-btn" onClick={handleCancel}>×</button>
                    </div>

                    <div className="crop-container">
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            cropShape="round"
                            showGrid={false}
                            objectFit="contain"
                            onCropChange={onCropChange}
                            onZoomChange={onZoomChange}
                            onCropComplete={onCropCompleteCallback}
                        />
                    </div>

                    <div className="crop-controls">
                        <div className="crop-instructions">
                            <p>💡 Drag to reposition • Use slider to zoom</p>
                        </div>
                        
                        <div className="zoom-control">
                            <span className="zoom-label">Zoom</span>
                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.1}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="zoom-slider"
                            />
                            <span className="zoom-value">{zoom.toFixed(1)}x</span>
                        </div>

                        <div className="crop-actions">
                            <button 
                                className="btn-cancel-crop" 
                                onClick={handleCancel}
                                disabled={isProcessing}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn-save-crop" 
                                onClick={createCroppedImage}
                                disabled={isProcessing}
                            >
                                {isProcessing ? 'Processing...' : 'Save Photo'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

/**
 * Helper function to create cropped image blob
 */
async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const maxSize = 400; // Output size: 400x400px

    canvas.width = maxSize;
    canvas.height = maxSize;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        maxSize,
        maxSize
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error('Canvas is empty'));
                    return;
                }
                blob.name = 'cropped-profile.jpg';
                resolve(blob);
            },
            'image/jpeg',
            0.85 // Quality: 85% (optimized size < 300KB)
        );
    });
}

/**
 * Helper to create image element from src
 */
function createImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.setAttribute('crossOrigin', 'anonymous');
        image.src = url;
    });
}

export default ImageCropModal;
