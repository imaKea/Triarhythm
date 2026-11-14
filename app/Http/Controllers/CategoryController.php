<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    // Bài 2 Câu 2.1: Thêm dữ liệu bằng Model Eloquent
    public function addCategory()
    {
        Category::create([
            'name' => 'Thời sự',
            'description' => 'Chuyên mục thông tin về Thời sự',
        ]);

        Category::create([
            'name' => 'Thể thao',
            'description' => 'Chuyên mục thông tin về Thể thao',
        ]);

        Category::create([
            'name' => 'Giải trí',
            'description' => 'Chuyên mục thông tin về Giải trí',
        ]);

        return 'Categories được thêm bằng Model Eloquent thành công từ Controller!';
    }

    // Bài 3 Câu 3.1: Cập nhật dữ liệu bằng Eloquent ORM
    public function Update()
    {
        $category = Category::where('name', 'Bóng đá')->first();
        if (!$category) {
            $category = Category::where('name', 'Thể thao')->first();
        }
        if (!$category) {
            $category = Category::first();
        }

        if ($category) {
            $category->name = 'Thể thao';
            $category->description = 'Chuyên mục thông tin về Thể thao';
            $category->save();
            return 'Category được cập nhật bằng Eloquent ORM thành công từ Controller!';
        }

        return 'Category không tìm thấy';
    }

    // Bài 4 Câu 4.1: Xóa dữ liệu bằng Eloquent ORM
    public function Delete($id)
    {
        $category = Category::find($id);

        if ($category) {
            $category->delete();
            return 'Category có ID=' . $id . ' đã được xóa thành công!';
        }

        return 'Category có ID=' . $id . ' không tìm thấy';
    }

    // Bài 7 Câu 7.1: Sử dụng Eloquent ORM để truy vấn và lọc dữ liệu
    public function listEloquentwhereLike()
    {
        // Truy vấn các danh mục có mô tả chứa từ khóa "thông tin"
        $categories = Category::where('description', 'like', '%thông tin%')
            ->orWhere('description', 'like', '%Thông tin%')
            ->get();

        return view('categories.listEloquentwhereLike', ['categories' => $categories]);
    }
}
