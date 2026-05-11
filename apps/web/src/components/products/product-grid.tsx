import ProductCard, { type ProductCardData } from "./product-card";

export default function ProductGrid({ products }: { products: ProductCardData[] }) {
  if (products.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-card/30 p-10 text-center">
        <div className="text-3xl">🧘</div>
        <p className="mt-3 text-sm font-medium">No products yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create your first workspace to start feeding Budda.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
