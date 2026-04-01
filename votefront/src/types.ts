export interface Nominee {
  id: number;
  name: string;
  photo_url: string;
}

export interface Category {
  category_id: number;
  category_name: string;
  nominees: Nominee[];
}

export interface VoteSelection {
  category_id: number;
  nominee_id: number;
}