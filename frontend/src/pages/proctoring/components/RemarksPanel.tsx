/**
 * Remarks Panel Component
 * For proctor to add notes and observations
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface RemarksPanelProps {
  remarks: any[];
  onAddRemark: (text: string) => void;
  onClose: () => void;
}

export const RemarksPanel: React.FC<RemarksPanelProps> = ({
  remarks,
  onAddRemark,
  onClose,
}) => {
  const [newRemark, setNewRemark] = useState('');

  const handleAdd = () => {
    if (newRemark.trim()) {
      onAddRemark(newRemark);
      setNewRemark('');
    }
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-gray-800 border-l border-gray-700 shadow-lg flex flex-col z-40">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h3 className="font-bold">Notes & Observations</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Remarks List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {remarks.length === 0 ? (
          <p className="text-gray-400 text-sm">No notes yet</p>
        ) : (
          remarks.map((remark) => (
            <div
              key={remark.id}
              className="bg-gray-700/50 p-3 rounded border border-gray-600 text-sm"
            >
              <p>{remark.text}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(remark.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Add Remark */}
      <div className="p-4 border-t border-gray-700 space-y-2">
        <Input
          placeholder="Add a note..."
          value={newRemark}
          onChange={(e) => setNewRemark(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          className="bg-gray-700 border-gray-600 text-white placeholder-gray-500"
        />
        <Button
          onClick={handleAdd}
          disabled={!newRemark.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          Add Note
        </Button>
      </div>
    </div>
  );
};
