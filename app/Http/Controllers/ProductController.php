<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Pagination\LengthAwarePaginator;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        // Lấy dữ liệu từ database
        $productsDB = Product::all();
        // Tạo Collection
        $products = collect($productsDB);

        // Tìm kiếm
        if ($request->has('search') && $request->input('search') != '') {
            $search = $request->input('search');
            $products = $products->filter(function ($product) use ($search) {
                return stripos($product->name, $search) !== false;
            });
        }

        // Lọc theo giá
        if ($request->has('price_filter') && $request->input('price_filter') != '') {
            $priceFilter = $request->input('price_filter');
            if ($priceFilter == 'below_20000000') {
                $products = $products->where('price', '<', 20000000);
            } elseif ($priceFilter == 'above_20000000') {
                $products = $products->where('price', '>=', 20000000);
            } else {
                $products = $products->where('price', '>', 0);
            }
        }

        // Xử lý sắp xếp
        if ($request->has('sort_by') && $request->input('sort_by') != '') {
            $sortBy = $request->input('sort_by');
            $sortOrder = $request->input('sort_order', 'asc');
            if ($sortBy == 'name') {
                $products = ($sortOrder == 'asc') ? $products->sortBy('name') : $products->sortByDesc('name');
            } elseif ($sortBy == 'price') {
                $products = ($sortOrder == 'asc') ? $products->sortBy('price') : $products->sortByDesc('price');
            }
        }

        // Phân trang với 10 sản phẩm mỗi trang
        $currentPage = LengthAwarePaginator::resolveCurrentPage();
        $perPage = 10;
        $paginatedProducts = new LengthAwarePaginator(
            $products->forPage($currentPage, $perPage)->values(),
            $products->count(),
            $perPage,
            $currentPage,
            ['path' => LengthAwarePaginator::resolveCurrentPath(), 'query' => $request->query()]
        );

        return view('products.index', compact('paginatedProducts'));
    }

    public function listproducts(Request $request)
    {
        $productsDB = Product::all();
        $products = collect($productsDB);

        if ($request->has('search') && $request->input('search') != '') {
            $search = $request->input('search');
            $products = $products->filter(function ($product) use ($search) {
                return stripos($product->name, $search) !== false;
            });
        }

        if ($request->has('price_filter') && $request->input('price_filter') != '') {
            $priceFilter = $request->input('price_filter');
            if ($priceFilter == 'below_20000000') {
                $products = $products->where('price', '<', 20000000);
            } elseif ($priceFilter == 'above_20000000') {
                $products = $products->where('price', '>=', 20000000);
            } else {
                $products = $products->where('price', '>', 0);
            }
        }

        if ($request->has('sort_by') && $request->input('sort_by') != '') {
            $sortBy = $request->input('sort_by');
            $sortOrder = $request->input('sort_order', 'asc');
            if ($sortBy == 'name') {
                $products = ($sortOrder == 'asc') ? $products->sortBy('name') : $products->sortByDesc('name');
            } elseif ($sortBy == 'price') {
                $products = ($sortOrder == 'asc') ? $products->sortBy('price') : $products->sortByDesc('price');
            }
        }

        $currentPage = LengthAwarePaginator::resolveCurrentPage();
        $perPage = 10;
        $paginatedProducts = new LengthAwarePaginator(
            $products->forPage($currentPage, $perPage)->values(),
            $products->count(),
            $perPage,
            $currentPage,
            ['path' => LengthAwarePaginator::resolveCurrentPath(), 'query' => $request->query()]
        );

        return view('products.listproducts', compact('paginatedProducts'));
    }

    public function create()
    {
        return view('products.create');
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required',
            'description' => 'required',
            'price' => 'required|numeric',
            'product_image' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg|max:2048',
        ]);

        $data = $request->all();

        if ($request->hasFile('product_image')) {
            $data['product_image'] = $request->file('product_image')->store('images', 'public');
        }

        Product::create($data);

        return redirect()->route('products.index')->with('success', 'Sản phẩm đã được thêm thành công.');
    }

    public function show($id)
    {
        $product = Product::findOrFail($id);
        return view('products.show', compact('product'));
    }

    public function edit(Product $product)
    {
        return view('products.edit', compact('product'));
    }

    public function update(Request $request, Product $product)
    {
        $request->validate([
            'name' => 'required',
            'description' => 'required',
            'price' => 'required|numeric',
            'product_image' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg|max:2048',
        ]);

        $data = $request->all();

        if ($request->hasFile('product_image')) {
            if ($product->product_image) {
                Storage::disk('public')->delete($product->product_image);
            }
            $data['product_image'] = $request->file('product_image')->store('images', 'public');
        }

        $product->update($data);

        return redirect()->route('products.index')->with('success', 'Sản phẩm đã được cập nhật thành công.');
    }

    public function destroy(Product $product)
    {
        if ($product->product_image) {
            Storage::disk('public')->delete($product->product_image);
        }

        $product->delete();

        return redirect()->route('products.index')->with('success', 'Sản phẩm đã được xóa thành công.');
    }
}
