<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'description', 'content', 'category_id'];

    // Thiết lập quan hệ với Category
    public function category()
    {
        return $this->belongsTo(Category::class);
    }
}
