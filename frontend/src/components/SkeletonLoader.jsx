import React from 'react';
import './SkeletonLoader.css';

const SkeletonLoader = ({ type = 'card', count = 1 }) => {
    const renderSkeleton = () => {
        switch (type) {
            case 'card':
                return <CardSkeleton />;
            case 'stat':
                return <StatSkeleton />;
            case 'list':
                return <ListSkeleton />;
            case 'table':
                return <TableSkeleton />;
            case 'profile':
                return <ProfileSkeleton />;
            default:
                return <CardSkeleton />;
        }
    };

    return (
        <div className="skeleton-container">
            {Array.from({ length: count }).map((_, index) => (
                <div key={index} className="skeleton-item">
                    {renderSkeleton()}
                </div>
            ))}
        </div>
    );
};

const CardSkeleton = () => (
    <div className="skeleton-card">
        <div className="skeleton skeleton-title"></div>
        <div className="skeleton skeleton-text"></div>
        <div className="skeleton skeleton-text short"></div>
        <div className="skeleton skeleton-button"></div>
    </div>
);

const StatSkeleton = () => (
    <div className="skeleton-stat">
        <div className="skeleton skeleton-icon"></div>
        <div className="skeleton skeleton-value"></div>
        <div className="skeleton skeleton-label"></div>
    </div>
);

const ListSkeleton = () => (
    <div className="skeleton-list">
        {[1, 2, 3, 4].map((item) => (
            <div key={item} className="skeleton-list-item">
                <div className="skeleton skeleton-avatar"></div>
                <div className="skeleton-list-content">
                    <div className="skeleton skeleton-text"></div>
                    <div className="skeleton skeleton-text short"></div>
                </div>
            </div>
        ))}
    </div>
);

const TableSkeleton = () => (
    <div className="skeleton-table">
        <div className="skeleton-table-header">
            {[1, 2, 3, 4].map((col) => (
                <div key={col} className="skeleton skeleton-text"></div>
            ))}
        </div>
        {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="skeleton-table-row">
                {[1, 2, 3, 4].map((col) => (
                    <div key={col} className="skeleton skeleton-text short"></div>
                ))}
            </div>
        ))}
    </div>
);

const ProfileSkeleton = () => (
    <div className="skeleton-profile">
        <div className="skeleton skeleton-avatar-large"></div>
        <div className="skeleton skeleton-title"></div>
        <div className="skeleton skeleton-text"></div>
        <div className="skeleton-profile-stats">
            {[1, 2, 3].map((stat) => (
                <div key={stat} className="skeleton skeleton-stat-box"></div>
            ))}
        </div>
    </div>
);

export default SkeletonLoader;
