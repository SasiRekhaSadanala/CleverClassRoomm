import pymongo

def run():
    client = pymongo.MongoClient('mongodb://localhost:27017')
    db = client['asc_db']
    
    # These quizzes were generated before we added privacy tracking
    result = db.quizzes.delete_many({
        'title': {'$regex': '^(w1|AI Quiz: .*)$'},
        'creator_id': None
    })
    
    print(f"Deleted {result.deleted_count} old test quizzes.")
    client.close()

if __name__ == "__main__":
    run()
