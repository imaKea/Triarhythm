<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class NewsController extends Controller
{
    public function index()
    {
        $articles = collect([
            (object)['id' => 1, 'title' => 'Xu hướng thời trang hè 2026', 'content' => 'Nội dung chi tiết về xu hướng thời trang mùa hè mới nhất với phong cách trẻ trung năng động.'],
            (object)['id' => 2, 'title' => 'Cách phối đồ công sở thanh lịch', 'content' => 'Gợi ý các set đồ công sở hiện đại, vừa thanh lịch vừa thoải mái cho cả ngày dài làm việc.'],
            (object)['id' => 3, 'title' => 'Phụ kiện không thể thiếu mùa thu đông', 'content' => 'Những phụ kiện thời trang tạo điểm nhấn ấn tượng cho trang phục của bạn trong mùa thu đông.'],
        ]);
        return view('pages.news.index', compact('articles'));
    }

    public function show($id)
    {
        $articles = collect([
            1 => (object)['id' => 1, 'title' => 'Xu hướng thời trang hè 2026', 'content' => 'Nội dung chi tiết về xu hướng thời trang mùa hè mới nhất với phong cách trẻ trung năng động.'],
            2 => (object)['id' => 2, 'title' => 'Cách phối đồ công sở thanh lịch', 'content' => 'Gợi ý các set đồ công sở hiện đại, vừa thanh lịch vừa thoải mái cho cả ngày dài làm việc.'],
            3 => (object)['id' => 3, 'title' => 'Phụ kiện không thể thiếu mùa thu đông', 'content' => 'Những phụ kiện thời trang tạo điểm nhấn ấn tượng cho trang phục của bạn trong mùa thu đông.'],
        ]);
        $article = $articles->get($id, (object)['id' => $id, 'title' => 'Bài viết ' . $id, 'content' => 'Nội dung chi tiết của bài viết số ' . $id]);
        return view('pages.news.show', compact('article'));
    }
}
