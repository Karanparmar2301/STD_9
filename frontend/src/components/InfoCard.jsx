import React from 'react';
import { motion } from 'framer-motion';
import './InfoCard.css';

/**
 * InfoCard Component
 * 
 * Reusable card component for displaying personal information fields
 * with consistent styling, responsive behavior, and smooth animations.
 * 
 * @param {string} label - The field label (e.g., "STUDENT NAME")
 * @param {string} value - The field value
 * @param {number} index - Card index for color accent variation and animation delay
 */
function InfoCard({ label, value, index = 0 }) {
    return (
        <motion.div
            className="info-card"
            data-index={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.4,
                delay: index * 0.05,
                ease: 'easeInOut'
            }}
            whileHover={{
                y: -4,
                transition: { duration: 0.3, ease: 'easeInOut' }
            }}
        >
            <label className="info-card-label">{label}</label>
            <p className="info-card-value">{value || 'N/A'}</p>
        </motion.div>
    );
}

export default InfoCard;
