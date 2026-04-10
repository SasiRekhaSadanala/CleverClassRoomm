import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-[family-name:var(--font-geist-sans)]">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            CleverClassRoom
          </h1>
          <div>
            <Link
              href="/login"
              className="text-sm font-semibold text-blue-600 hover:text-blue-500 mr-4"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold text-gray-700 hover:text-gray-900"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="grow flex items-center justify-center">
        <div className="text-center bg-white p-12 rounded-2xl shadow-xl max-w-lg">
          <h2 className="text-2xl font-bold tracking-tight text-black mb-4">
            Welcome to CleverClassRoom
          </h2>
          <p className="text-black mb-8">
            Create your own classrooms, share a code with others to join, and
            learn together with AI-powered tools.
          </p>
          <Link
            href="/login"
            className="rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Get Started
          </Link>
        </div>
      </main>
    </div>
  );
}
