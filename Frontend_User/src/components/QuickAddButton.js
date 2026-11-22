import React from 'react';
import { FiPlus, FiShoppingCart } from 'react-icons/fi';
import { useCart } from '../contexts/CartContext';

export default function QuickAddButton({ product, available }) {
  const { addItem } = useCart();

  if (!available) return null;
  return (
    <button
      type="button"
      className="quick-add-button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        addItem(product);
      }}
    >
      <FiShoppingCart /> <span>Add</span> <FiPlus />
    </button>
  );
}
