<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PostController extends Controller
{
    // Bài 2 Câu 2.2: Thêm dữ liệu cho bảng Posts bằng Query Builder
    public function addpost()
    {
        $cat1 = Category::first()->id ?? 1;

        DB::table('posts')->insert([
            [
                'name' => 'Bài viết 1',
                'description' => 'Mô tả bài viết 1',
                'content' => 'Nội dung chi tiết của bài viết 1',
                'category_id' => $cat1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Bài viết 2',
                'description' => 'Mô tả bài viết 2',
                'content' => 'Nội dung chi tiết của bài viết 2',
                'category_id' => $cat1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Bài viết 3',
                'description' => 'Mô tả bài viết 3',
                'content' => 'Nội dung chi tiết của bài viết 3',
                'category_id' => $cat1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        return 'Posts được thêm bằng Query Builder thành công từ Controller!';
    }

    // Bài 3 Câu 3.2: Cập nhật dữ liệu bằng Query Builder
    public function updatePost($id)
    {
        DB::table('posts')
            ->where('id', $id)
            ->update([
                'name' => 'Tên của Post có ID ' . $id . ' đã được cập nhật',
                'description' => 'Mô tả của Post có ID = ' . $id . ' đã được cập nhật',
                'content' => 'Nội dung của Post có ID = ' . $id . ' đã được cập nhật'
            ]);

        return 'Post có ID=' . $id . ' đã được cập nhật từ Controller!';
    }

    // Bài 4 Câu 4.2: Xóa dữ liệu bằng Query Builder
    public function deletePost($id)
    {
        $deleted = DB::table('posts')->where('id', $id)->delete();

        if ($deleted) {
            return "Post có ID = $id được xóa thành công từ Controller!";
        } else {
            return "Post có ID = $id không tìm thấy.";
        }
    }

    // Bài 7 Câu 7.2: Sử dụng Query Builder để truy vấn và lọc dữ liệu
    public function listQueryBuilderwhereLike()
    {
        $posts = DB::table('posts')
            ->select('id', 'name', 'description', 'content')
            ->where('name', 'LIKE', '%Bài viết%')
            ->get();

        return view('posts.listQueryBuilderwhereLike', compact('posts'));
    }

    // Bài 8 Câu 8.1: Sử dụng Eloquent ORM để truy vấn phức tạp và phân trang dữ liệu
    public function listPostEloquentPaginate10()
    {
        $posts = Post::with('category')
            ->select('posts.*')
            ->paginate(10);

        return view('posts.listPostEloquentPaginate10', compact('posts'));
    }

    // Bài 8 Câu 8.2: Sử dụng Query Builder để truy vấn phức tạp và phân trang dữ liệu
    public function listPostQueryBuilderPaginate10()
    {
        $posts = DB::table('posts')
            ->join('categories', 'posts.category_id', '=', 'categories.id')
            ->select('posts.id', 'posts.name', 'posts.description', 'categories.name as category_name', 'posts.content')
            ->paginate(10);

        return view('posts.listPostQueryBuilderPaginate10', compact('posts'));
    }
}
